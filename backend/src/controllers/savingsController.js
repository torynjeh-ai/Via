const { body } = require('express-validator');
const { query } = require('../config/database');
const { validate } = require('../middleware/validate');
const { processPayment } = require('../services/paymentService');
const walletService = require('../services/walletService');
const { sendNotificationToUser } = require('../services/notificationService');
const logger = require('../utils/logger');

const TC_TO_XAF = 10000;
const EARLY_WITHDRAWAL_FEE = 0.02; // 2%
const COMPLETION_BONUS_RATE = 0.005; // 0.5% bonus on completion

const CATEGORIES = ['General', 'Education', 'Health', 'Travel', 'Business', 'Emergency', 'Housing', 'Technology', 'Other'];

// GET /savings — list all goals for the user
const getGoals = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT * FROM savings_goals WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) { next(error); }
};

// GET /savings/:id — single goal with deposit history
const getGoal = async (req, res, next) => {
  try {
    const goalRes = await query(
      `SELECT * FROM savings_goals WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!goalRes.rows[0]) return res.status(404).json({ success: false, message: 'Goal not found' });

    const depositsRes = await query(
      `SELECT * FROM savings_deposits WHERE goal_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [req.params.id]
    );

    res.json({ success: true, data: { ...goalRes.rows[0], deposits: depositsRes.rows } });
  } catch (error) { next(error); }
};

// POST /savings — create a new goal
const createGoal = [
  body('name').trim().notEmpty().withMessage('Goal name is required'),
  body('target_amount').isFloat({ min: 100 }).withMessage('Target amount must be at least 100 XAF'),
  body('target_date').isISO8601().withMessage('Valid target date is required'),
  body('category').optional().isIn(CATEGORIES),
  body('auto_save_amount').optional().isFloat({ min: 0 }),
  body('auto_save_frequency').optional().isIn(['daily', 'weekly', 'monthly']),
  validate,
  async (req, res, next) => {
    try {
      const { name, description, category, target_amount, target_date,
              auto_save_enabled, auto_save_amount, auto_save_frequency } = req.body;

      const result = await query(
        `INSERT INTO savings_goals
           (user_id, name, description, category, target_amount, target_date,
            auto_save_enabled, auto_save_amount, auto_save_frequency)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        [req.user.id, name, description || null, category || 'General',
         target_amount, target_date,
         auto_save_enabled || false,
         auto_save_amount || null,
         auto_save_frequency || null]
      );

      res.status(201).json({ success: true, message: 'Savings goal created!', data: result.rows[0] });
    } catch (error) { next(error); }
  },
];

// PATCH /savings/:id — update goal settings
const updateGoal = [
  body('name').optional().trim().notEmpty(),
  body('target_amount').optional().isFloat({ min: 100 }),
  body('target_date').optional().isISO8601(),
  body('auto_save_enabled').optional().isBoolean(),
  body('auto_save_amount').optional().isFloat({ min: 0 }),
  body('auto_save_frequency').optional().isIn(['daily', 'weekly', 'monthly']),
  validate,
  async (req, res, next) => {
    try {
      const check = await query(
        `SELECT id, status FROM savings_goals WHERE id = $1 AND user_id = $2`,
        [req.params.id, req.user.id]
      );
      if (!check.rows[0]) return res.status(404).json({ success: false, message: 'Goal not found' });
      if (check.rows[0].status !== 'active') return res.status(400).json({ success: false, message: 'Cannot edit a completed or withdrawn goal' });

      const { name, description, category, target_amount, target_date,
              auto_save_enabled, auto_save_amount, auto_save_frequency } = req.body;

      const result = await query(
        `UPDATE savings_goals SET
           name                 = COALESCE($1, name),
           description          = COALESCE($2, description),
           category             = COALESCE($3, category),
           target_amount        = COALESCE($4, target_amount),
           target_date          = COALESCE($5, target_date),
           auto_save_enabled    = COALESCE($6, auto_save_enabled),
           auto_save_amount     = COALESCE($7, auto_save_amount),
           auto_save_frequency  = COALESCE($8, auto_save_frequency),
           updated_at           = NOW()
         WHERE id = $9 AND user_id = $10
         RETURNING *`,
        [name ?? null, description ?? null, category ?? null,
         target_amount ?? null, target_date ?? null,
         auto_save_enabled ?? null, auto_save_amount ?? null, auto_save_frequency ?? null,
         req.params.id, req.user.id]
      );

      res.json({ success: true, data: result.rows[0] });
    } catch (error) { next(error); }
  },
];

// POST /savings/:id/deposit — add money to a goal (stays in sub-wallet)
const deposit = [
  body('amount_xaf').isFloat({ min: 1 }).withMessage('Amount must be greater than 0'),
  body('payment_method').isIn(['tc_wallet', 'mtn_momo', 'orange_money', 'bank_transfer', 'card', 'apple_pay', 'paypal']),
  validate,
  async (req, res, next) => {
    try {
      const goalRes = await query(
        `SELECT * FROM savings_goals WHERE id = $1 AND user_id = $2`,
        [req.params.id, req.user.id]
      );
      const goal = goalRes.rows[0];
      if (!goal) return res.status(404).json({ success: false, message: 'Goal not found' });
      if (goal.status !== 'active') return res.status(400).json({ success: false, message: 'Goal is not active' });

      const { amount_xaf, payment_method } = req.body;
      const remaining = Number(goal.target_amount) - Number(goal.saved_amount);

      if (amount_xaf > remaining) {
        return res.status(400).json({
          success: false,
          message: `Deposit of ${Number(amount_xaf).toLocaleString()} XAF exceeds remaining target of ${remaining.toLocaleString()} XAF`,
          remaining,
        });
      }

      let transactionId = null;

      if (payment_method === 'tc_wallet') {
        // Deduct from TC wallet → move into sub-wallet
        const tcAmount = amount_xaf / TC_TO_XAF;
        const walletResult = await walletService.payContribution({
          userId: req.user.id,
          groupId: null,
          cycleNumber: 0,
          tcAmount,
        });
        if (!walletResult.success) return res.status(400).json({ success: false, message: walletResult.message });
      } else {
        // External payment (MTN, Orange, PayPal, etc.) → money comes from outside
        // Process the external payment
        const payment = await processPayment({
          method: payment_method,
          phone: req.user.phone,
          amount: amount_xaf,
          reference: req.params.id,
          description: `Savings deposit — ${goal.name}`,
        });
        if (!payment.success) return res.status(400).json({ success: false, message: payment.message });
        transactionId = payment.transactionId;
        // NOTE: Money stays in sub-wallet (savings_goals.saved_amount)
        // It does NOT go to TC wallet until the user withdraws or completes the goal
      }

      // Record deposit in sub-wallet only
      const depositRes = await query(
        `INSERT INTO savings_deposits (goal_id, user_id, amount_xaf, payment_method, transaction_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [goal.id, req.user.id, amount_xaf, payment_method, transactionId]
      );
      const depositId = depositRes.rows[0].id;

      const newSaved  = Number(goal.saved_amount) + amount_xaf;
      const isComplete = newSaved >= Number(goal.target_amount);

      let bonusEarned = 0;
      if (isComplete) {
        const now      = new Date();
        const deadline = new Date(goal.target_date);
        const onTime   = now <= deadline;
        if (onTime) bonusEarned = Math.round(Number(goal.target_amount) * COMPLETION_BONUS_RATE);

        await query(
          `UPDATE savings_goals SET
             saved_amount = $1, status = 'completed', completed_at = NOW(),
             bonus_earned = $2, updated_at = NOW()
           WHERE id = $3`,
          [newSaved, bonusEarned, goal.id]
        );

        // Savings stay as real money — no TC wallet conversion.
        // Notify the user their goal is complete.
        await sendNotificationToUser({
          userId: req.user.id,
          title: '🎉 Savings Goal Completed!',
          message: `Congratulations! You've reached your "${goal.name}" goal of ${Number(goal.target_amount).toLocaleString()} XAF!${bonusEarned > 0 ? ` You earned a ${bonusEarned.toLocaleString()} XAF completion bonus — withdraw your savings to claim it.` : ' You can now withdraw your savings.'}`,
          type: 'group_update',
          groupId: null,
        });
      } else {
        await query(
          `UPDATE savings_goals SET saved_amount = $1, updated_at = NOW() WHERE id = $2`,
          [newSaved, goal.id]
        );

        // Milestone notifications
        const pct     = Math.round((newSaved / Number(goal.target_amount)) * 100);
        const prevPct = Math.round((Number(goal.saved_amount) / Number(goal.target_amount)) * 100);
        for (const milestone of [25, 50, 75]) {
          if (prevPct < milestone && pct >= milestone) {
            await sendNotificationToUser({
              userId: req.user.id,
              title: `${milestone}% of your goal reached! 🎯`,
              message: `You're ${milestone}% of the way to your "${goal.name}" goal. Keep it up!`,
              type: 'group_update',
              groupId: null,
            });
          }
        }
      }

      res.json({
        success: true,
        message: isComplete
          ? `🎉 Goal completed! You can now withdraw your ${(newSaved + bonusEarned).toLocaleString()} XAF${bonusEarned > 0 ? ` (includes ${bonusEarned.toLocaleString()} XAF bonus)` : ''}.`
          : `Deposit successful! ${(remaining - amount_xaf).toLocaleString()} XAF remaining.`,
        data: {
          deposit_id:   depositId,
          saved:        newSaved,
          target:       Number(goal.target_amount),
          remaining:    Math.max(0, Number(goal.target_amount) - newSaved),
          percent:      Math.round((newSaved / Number(goal.target_amount)) * 100),
          is_complete:  isComplete,
          bonus_earned: bonusEarned,
        },
      });
    } catch (error) { next(error); }
  },
];

// POST /savings/:id/withdraw — early withdrawal (2% fee, lose bonus, moves to TC wallet or external)
const withdraw = async (req, res, next) => {
  try {
    const goalRes = await query(
      `SELECT * FROM savings_goals WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    const goal = goalRes.rows[0];
    if (!goal) return res.status(404).json({ success: false, message: 'Goal not found' });
    if (goal.status !== 'active') return res.status(400).json({ success: false, message: 'Goal is not active' });
    if (Number(goal.saved_amount) <= 0) return res.status(400).json({ success: false, message: 'No savings to withdraw' });

    const { withdrawal_method = 'tc_wallet' } = req.body;

    const savedXaf = Number(goal.saved_amount);
    const fee      = Math.round(savedXaf * EARLY_WITHDRAWAL_FEE); // 2% stays with platform
    const netXaf   = savedXaf - fee;

    // Process external disbursement — savings are real money, not TC
    if (withdrawal_method !== 'tc_wallet') {
      const payment = await processPayment({
        method: withdrawal_method,
        phone: req.user.phone,
        amount: netXaf,
        reference: goal.id,
        description: `Savings withdrawal — ${goal.name}`,
      });
      if (!payment.success) {
        return res.status(400).json({ success: false, message: payment.message || 'Withdrawal failed' });
      }
    }
    // tc_wallet: in dev/mock mode processPayment is mocked — just record the withdrawal

    await query(
      `UPDATE savings_goals SET
         status = 'withdrawn', withdrawn_at = NOW(),
         bonus_earned = 0, updated_at = NOW()
       WHERE id = $1`,
      [goal.id]
    );

    // Record the withdrawal for receipt purposes
    const withdrawalRes = await query(
      `INSERT INTO savings_withdrawals (goal_id, user_id, gross_amount_xaf, fee_xaf, net_amount_xaf, withdrawal_method)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [goal.id, req.user.id, savedXaf, fee, netXaf, withdrawal_method]
    );
    const withdrawalId = withdrawalRes.rows[0].id;

    await sendNotificationToUser({
      userId: req.user.id,
      title: 'Savings Withdrawal Processed',
      message: `${netXaf.toLocaleString()} XAF from "${goal.name}" has been sent to your ${withdrawal_method.replace(/_/g, ' ')}. A 2% early withdrawal fee of ${fee.toLocaleString()} XAF was retained. Any bonus was forfeited.`,
      type: 'group_update',
      groupId: null,
    });

    res.json({
      success: true,
      message: `${netXaf.toLocaleString()} XAF withdrawn (${fee.toLocaleString()} XAF fee deducted).`,
      data: { net_amount: netXaf, fee, withdrawal_method, withdrawal_id: withdrawalId },
    });
  } catch (error) { next(error); }
};

// DELETE /savings/:id — delete a goal (only if no savings)
const deleteGoal = async (req, res, next) => {
  try {
    const goalRes = await query(
      `SELECT saved_amount FROM savings_goals WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!goalRes.rows[0]) return res.status(404).json({ success: false, message: 'Goal not found' });
    if (Number(goalRes.rows[0].saved_amount) > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete a goal with savings. Withdraw first.' });
    }
    await query(`DELETE FROM savings_goals WHERE id = $1`, [req.params.id]);
    res.json({ success: true, message: 'Goal deleted' });
  } catch (error) { next(error); }
};

module.exports = { getGoals, getGoal, createGoal, updateGoal, deposit, withdraw, deleteGoal };
