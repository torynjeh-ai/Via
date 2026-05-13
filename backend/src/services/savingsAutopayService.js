/**
 * Savings Auto-Save Service
 *
 * Runs on a schedule and automatically deposits from TC wallet into savings goals
 * for users who have auto_save_enabled = true.
 *
 * Frequency logic:
 *   - daily:   runs every day
 *   - weekly:  runs on Mondays
 *   - monthly: runs on the 1st of each month
 */

const { query } = require('../config/database');
const walletService = require('./walletService');
const { sendNotificationToUser } = require('./notificationService');
const logger = require('../utils/logger');

const TC_TO_XAF = 10000;
const COMPLETION_BONUS_RATE = 0.005;

const runSavingsAutopay = async () => {
  try {
    const now        = new Date();
    const dayOfWeek  = now.getDay();   // 0=Sun, 1=Mon
    const dayOfMonth = now.getDate();

    // Fetch all active goals with auto-save enabled
    const goalsRes = await query(
      `SELECT sg.*, u.tc_balance, u.phone
       FROM savings_goals sg
       JOIN users u ON sg.user_id = u.id
       WHERE sg.status = 'active'
         AND sg.auto_save_enabled = TRUE
         AND sg.auto_save_amount IS NOT NULL
         AND sg.auto_save_amount > 0`
    );

    for (const goal of goalsRes.rows) {
      const { auto_save_frequency, auto_save_amount } = goal;

      // Check if today is the right day for this frequency
      const shouldRun =
        auto_save_frequency === 'daily' ||
        (auto_save_frequency === 'weekly'  && dayOfWeek === 1) ||
        (auto_save_frequency === 'monthly' && dayOfMonth === 1);

      if (!shouldRun) continue;

      const amountXaf  = Number(auto_save_amount);
      const remaining  = Number(goal.target_amount) - Number(goal.saved_amount);

      if (remaining <= 0) continue; // already at target

      // Don't overshoot the target
      const depositXaf = Math.min(amountXaf, remaining);
      const tcNeeded   = depositXaf / TC_TO_XAF;
      const tcBalance  = Number(goal.tc_balance);

      if (tcBalance < tcNeeded) {
        // Insufficient balance — notify user
        await sendNotificationToUser({
          userId:  goal.user_id,
          title:   '⚠️ Auto-Save Failed — Insufficient Balance',
          message: `Auto-save of ${depositXaf.toLocaleString()} XAF for your "${goal.name}" goal failed. Your TC wallet balance is too low. Please top up to continue saving automatically.`,
          type:    'group_update',
          groupId: null,
        }).catch(() => {});
        continue;
      }

      // Deduct from TC wallet
      const walletResult = await walletService.payContribution({
        userId:      goal.user_id,
        groupId:     null,
        cycleNumber: 0,
        tcAmount:    tcNeeded,
      });

      if (!walletResult.success) {
        logger.warn(`[SavingsAutopay] Wallet deduction failed for goal ${goal.id}: ${walletResult.message}`);
        continue;
      }

      // Record the deposit
      await query(
        `INSERT INTO savings_deposits (goal_id, user_id, amount_xaf, payment_method, transaction_id, is_auto_save)
         VALUES ($1, $2, $3, 'tc_wallet', NULL, TRUE)`,
        [goal.id, goal.user_id, depositXaf]
      );

      const newSaved   = Number(goal.saved_amount) + depositXaf;
      const isComplete = newSaved >= Number(goal.target_amount);

      if (isComplete) {
        const onTime     = now <= new Date(goal.target_date);
        const bonusEarned = onTime ? Math.round(Number(goal.target_amount) * COMPLETION_BONUS_RATE) : 0;

        await query(
          `UPDATE savings_goals SET saved_amount = $1, status = 'completed',
           completed_at = NOW(), bonus_earned = $2, updated_at = NOW() WHERE id = $3`,
          [newSaved, bonusEarned, goal.id]
        );

        // Savings stay as real money — no TC wallet conversion.
        await sendNotificationToUser({
          userId:  goal.user_id,
          title:   '🎉 Savings Goal Completed!',
          message: `Your auto-save completed your "${goal.name}" goal of ${Number(goal.target_amount).toLocaleString()} XAF!${bonusEarned > 0 ? ` You earned a ${bonusEarned.toLocaleString()} XAF completion bonus — withdraw your savings to claim it.` : ' You can now withdraw your savings.'}`,
          type:    'group_update',
          groupId: null,
        }).catch(() => {});
      } else {
        await query(
          `UPDATE savings_goals SET saved_amount = $1, updated_at = NOW() WHERE id = $2`,
          [newSaved, goal.id]
        );

        await sendNotificationToUser({
          userId:  goal.user_id,
          title:   '✅ Auto-Save Successful',
          message: `${depositXaf.toLocaleString()} XAF was automatically saved to your "${goal.name}" goal. ${(Number(goal.target_amount) - newSaved).toLocaleString()} XAF remaining.`,
          type:    'group_update',
          groupId: null,
        }).catch(() => {});
      }

      logger.info(`[SavingsAutopay] Saved ${depositXaf} XAF for goal "${goal.name}" (user ${goal.user_id})`);
    }
  } catch (err) {
    logger.error(`[SavingsAutopay] Scheduler error: ${err.message}`);
  }
};

module.exports = { runSavingsAutopay };
