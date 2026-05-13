const { body } = require('express-validator');
const { query } = require('../config/database');
const { validate } = require('../middleware/validate');
const { processPayment } = require('../services/paymentService');
const { sendNotificationToUser } = require('../services/notificationService');
const { processPayout, checkAndAutoCompleteCircle } = require('../services/payoutQueueService');
const { isLateContribution, calculatePenalty, distributePenaltyPool } = require('../services/contributionReminderService');
const walletService = require('../services/walletService');
const { recalculateTrustScore } = require('../services/trustScoreService');
const logger = require('../utils/logger');

const TC_TO_XAF = 10000;

/**
 * Get the current payout date for a group (used to check deadline).
 */
const getCurrentPayoutDate = async (groupId) => {
  const res = await query(
    `SELECT payout_date FROM payouts WHERE group_id = $1 AND status = 'current' LIMIT 1`,
    [groupId]
  );
  return res.rows[0]?.payout_date || null;
};

/**
 * After a successful contribution, check if all members have paid.
 * If so, automatically disburse the current payout.
 */
const checkAndAutoDisburse = async (groupId, cycleNumber) => {
  const memberCountRes = await query(
    `SELECT COUNT(*) as total FROM members WHERE group_id = $1 AND status = 'approved'`,
    [groupId]
  );
  const totalMembers = Number(memberCountRes.rows[0].total);

  const contribCountRes = await query(
    `SELECT COUNT(*) as paid FROM contributions
     WHERE group_id = $1 AND cycle_number = $2 AND status = 'completed'`,
    [groupId, cycleNumber]
  );
  const paidCount = Number(contribCountRes.rows[0].paid);

  if (paidCount < totalMembers) return;

  const currentPayoutRes = await query(
    `SELECT id FROM payouts WHERE group_id = $1 AND status = 'current' LIMIT 1`,
    [groupId]
  );
  if (!currentPayoutRes.rows[0]) return;

  await processPayout(currentPayoutRes.rows[0].id);
  await checkAndAutoCompleteCircle(groupId);
};

const contribute = [
  body('payment_method').isIn(['mtn_momo', 'orange_money', 'tc_wallet']).withMessage('Invalid payment method'),
  validate,
  async (req, res, next) => {
    try {
      const { id: groupId } = req.params;
      const { payment_method } = req.body;

      const groupRes = await query('SELECT * FROM groups WHERE id = $1', [groupId]);
      const group = groupRes.rows[0];
      if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
      if (group.status !== 'active') return res.status(400).json({ success: false, message: 'Group is not active' });
      if (group.group_type === 'flexible') return res.status(400).json({ success: false, message: 'Use POST /groups/:id/flexible-contributions for flexible groups' });

      const memberRes = await query(
        `SELECT * FROM members WHERE group_id = $1 AND user_id = $2 AND status = 'approved'`,
        [groupId, req.user.id]
      );
      if (!memberRes.rows[0]) return res.status(403).json({ success: false, message: 'Not a group member' });

      // Determine current cycle number
      const cycleRes = await query(
        `SELECT COALESCE(MAX(cycle_number), 0) + 1 as cycle FROM contributions WHERE group_id = $1`,
        [groupId]
      );
      const cycleNumber = cycleRes.rows[0].cycle;

      const paidRes = await query(
        `SELECT id FROM contributions WHERE group_id = $1 AND user_id = $2 AND cycle_number = $3 AND status = 'completed'`,
        [groupId, req.user.id, cycleNumber]
      );
      if (paidRes.rows[0]) return res.status(409).json({ success: false, message: 'Already contributed this cycle' });

      // ── Check if late and calculate total due ─────────────────────────────
      const payoutDate = await getCurrentPayoutDate(groupId);
      const hasPenaltyConfig = group.late_penalty_value && Number(group.late_penalty_value) > 0;
      const late = hasPenaltyConfig && payoutDate
        ? isLateContribution(payoutDate, group.deadline_days_before || 2)
        : false;

      const penaltyAmount = late
        ? calculatePenalty(Number(group.contribution_amount), group.late_penalty_type || 'fixed', Number(group.late_penalty_value))
        : 0;

      const totalDue = Number(group.contribution_amount) + Number(penaltyAmount);

      // ── Insert contribution record ─────────────────────────────────────────
      const contribRes = await query(
        `INSERT INTO contributions (group_id, user_id, amount, cycle_number, payment_method, is_late, penalty_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [groupId, req.user.id, totalDue, cycleNumber, payment_method, late, penaltyAmount]
      );
      const contribId = contribRes.rows[0].id;

      // ── TC wallet branch ───────────────────────────────────────────────────
      if (payment_method === 'tc_wallet') {
        const tcAmount = totalDue / TC_TO_XAF;
        const walletResult = await walletService.payContribution({
          userId: req.user.id,
          groupId,
          cycleNumber,
          tcAmount,
        });

        if (!walletResult.success) {
          await query(`UPDATE contributions SET status = 'failed' WHERE id = $1`, [contribId]);
          // Give a clear message if it's a balance issue on a late payment
          const message = late && walletResult.message?.includes('balance')
            ? `Insufficient balance. You owe ${totalDue.toLocaleString()} XAF (${group.contribution_amount.toLocaleString()} contribution + ${penaltyAmount.toLocaleString()} late penalty).`
            : walletResult.message;
          return res.status(400).json({ success: false, message });
        }

        await query(
          `UPDATE contributions SET status = 'completed', paid_at = NOW() WHERE id = $1`,
          [contribId]
        );

        // Notify admin
        const adminRes = await query(`SELECT user_id FROM members WHERE group_id = $1 AND role = 'admin'`, [groupId]);
        if (adminRes.rows[0]) {
          await sendNotificationToUser({
            userId: adminRes.rows[0].user_id,
            title: late ? '⚠️ Late Contribution Received' : 'New Contribution',
            message: late
              ? `${req.user.name} paid ${totalDue.toLocaleString()} XAF (includes ${penaltyAmount.toLocaleString()} XAF late penalty) via TC wallet`
              : `${req.user.name} has contributed ${group.contribution_amount} XAF via TC wallet`,
            type: 'contribution',
            groupId,
          });
        }

        // Notify the late payer
        if (late) {
          await sendNotificationToUser({
            userId: req.user.id,
            title:  '⚠️ Late Contribution Penalty Applied',
            message: `Your contribution of ${totalDue.toLocaleString()} XAF included a ${penaltyAmount.toLocaleString()} XAF late penalty. The penalty has been distributed to other group members.`,
            type:   'contribution',
            groupId,
          });
          // Distribute penalty to other members
          await distributePenaltyPool(groupId, cycleNumber, penaltyAmount, req.user.id);
        }

        await checkAndAutoDisburse(groupId, cycleNumber);
        recalculateTrustScore(req.user.id).catch(() => {});

        return res.json({
          success: true,
          message: late
            ? `Late contribution of ${totalDue.toLocaleString()} XAF processed (includes ${penaltyAmount.toLocaleString()} XAF penalty)`
            : 'Contribution successful',
          data: {
            contributionId: contribId,
            payment_method: 'tc_wallet',
            is_late: late,
            penalty_amount: penaltyAmount,
            total_paid: totalDue,
          },
        });
      }

      // ── Mobile money / card branch ─────────────────────────────────────────
      const payment = await processPayment({
        method: payment_method,
        phone:  req.user.phone,
        amount: totalDue,   // charge the full amount including penalty
        reference: contribId,
        description: late
          ? `Via contribution + late penalty - ${group.name}`
          : `Via contribution - ${group.name}`,
      });

      if (payment.success) {
        await query(
          `UPDATE contributions SET status = 'completed', transaction_id = $1, paid_at = NOW() WHERE id = $2`,
          [payment.transactionId, contribId]
        );

        // Notify admin
        const adminRes = await query(`SELECT user_id FROM members WHERE group_id = $1 AND role = 'admin'`, [groupId]);
        if (adminRes.rows[0]) {
          await sendNotificationToUser({
            userId: adminRes.rows[0].user_id,
            title: late ? '⚠️ Late Contribution Received' : 'New Contribution',
            message: late
              ? `${req.user.name} paid ${totalDue.toLocaleString()} XAF (includes ${penaltyAmount.toLocaleString()} XAF late penalty)`
              : `${req.user.name} has contributed ${group.contribution_amount} XAF`,
            type: 'contribution',
            groupId,
          });
        }

        // Notify the late payer and distribute penalty
        if (late) {
          await sendNotificationToUser({
            userId: req.user.id,
            title:  '⚠️ Late Contribution Penalty Applied',
            message: `Your contribution of ${totalDue.toLocaleString()} XAF included a ${penaltyAmount.toLocaleString()} XAF late penalty. The penalty has been distributed to other group members.`,
            type:   'contribution',
            groupId,
          });
          await distributePenaltyPool(groupId, cycleNumber, penaltyAmount, req.user.id);
        }

        await checkAndAutoDisburse(groupId, cycleNumber);
        recalculateTrustScore(req.user.id).catch(() => {});

        return res.json({
          success: true,
          message: late
            ? `Late contribution of ${totalDue.toLocaleString()} XAF processed (includes ${penaltyAmount.toLocaleString()} XAF penalty)`
            : 'Contribution successful',
          data: {
            transactionId: payment.transactionId,
            contributionId: contribId,
            is_late: late,
            penalty_amount: penaltyAmount,
            total_paid: totalDue,
          },
        });
      }

      await query(`UPDATE contributions SET status = 'failed' WHERE id = $1`, [contribId]);
      res.status(400).json({ success: false, message: payment.message });
    } catch (error) { next(error); }
  },
];

// GET /groups/:id/contributions
const getContributions = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT c.*, u.name, u.phone FROM contributions c
       JOIN users u ON c.user_id = u.id
       WHERE c.group_id = $1 ORDER BY c.created_at DESC`,
      [req.params.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) { next(error); }
};

// GET /groups/:id/contribution-info — returns amount due including any penalty
const getContributionInfo = async (req, res, next) => {
  try {
    const { id: groupId } = req.params;

    const groupRes = await query('SELECT * FROM groups WHERE id = $1', [groupId]);
    const group = groupRes.rows[0];
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });

    const payoutDate = await getCurrentPayoutDate(groupId);

    // Only apply penalty if the group has penalty settings configured
    const hasPenaltyConfig = group.late_penalty_value && Number(group.late_penalty_value) > 0;
    const late = hasPenaltyConfig && payoutDate
      ? isLateContribution(payoutDate, group.deadline_days_before || 2)
      : false;

    const penaltyAmount = late
      ? calculatePenalty(Number(group.contribution_amount), group.late_penalty_type || 'fixed', Number(group.late_penalty_value))
      : 0;

    const deadlineDate = payoutDate && hasPenaltyConfig
      ? (() => {
          const d = new Date(payoutDate);
          d.setDate(d.getDate() - (group.deadline_days_before || 2));
          return d;
        })()
      : null;

    res.json({
      success: true,
      data: {
        contribution_amount: Number(group.contribution_amount),
        is_late:             late,
        penalty_amount:      Number(penaltyAmount),
        total_due:           Number(group.contribution_amount) + Number(penaltyAmount),
        deadline_date:       deadlineDate,
        payout_date:         payoutDate,
      },
    });
  } catch (error) { next(error); }
};

module.exports = { contribute, getContributions, getContributionInfo };
