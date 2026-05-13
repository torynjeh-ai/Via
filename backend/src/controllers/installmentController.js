const { query } = require('../config/database');
const { sendNotificationToUser } = require('../services/notificationService');
const { processPayout } = require('../services/payoutQueueService');
const walletService = require('../services/walletService');
const { recalculateTrustScore } = require('../services/trustScoreService');
const logger = require('../utils/logger');

const TC_TO_XAF = 10000;
const EARLY_PAYOUT_FEE = 0.005; // 0.5%

// ── GET /groups/:id/pool ───────────────────────────────────────────────────
// Returns group pool status: total collected, target, per-member progress
const getGroupPool = async (req, res, next) => {
  try {
    const { id: groupId } = req.params;

    const groupRes = await query('SELECT * FROM groups WHERE id = $1', [groupId]);
    const group = groupRes.rows[0];
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    if (group.group_type === 'flexible') return res.status(400).json({ success: false, message: 'Use GET /groups/:id/flexible-pool for flexible groups' });

    // Current cycle number
    const cycleRes = await query(
      `SELECT COALESCE(MAX(cycle_number), 1) as cycle FROM contribution_installments WHERE group_id = $1`,
      [groupId]
    );
    const cycleNumber = Number(cycleRes.rows[0].cycle);

    // Approved member count
    const memberCountRes = await query(
      `SELECT COUNT(*) as total FROM members WHERE group_id = $1 AND status = 'approved'`,
      [groupId]
    );
    const memberCount = Number(memberCountRes.rows[0].total);

    const target = Number(group.contribution_amount) * memberCount;

    // Total collected this cycle across all installments
    const collectedRes = await query(
      `SELECT COALESCE(SUM(amount_xaf), 0) as total
       FROM contribution_installments
       WHERE group_id = $1 AND cycle_number = $2 AND status = 'completed'`,
      [groupId, cycleNumber]
    );
    const collected = Number(collectedRes.rows[0].total);

    // Per-member progress
    const memberProgressRes = await query(
      `SELECT
         ci.user_id,
         u.name,
         u.profile_picture_url,
         COALESCE(SUM(ci.amount_xaf), 0) as paid,
         $3::decimal as target
       FROM members m
       JOIN users u ON u.id = m.user_id
       LEFT JOIN contribution_installments ci
         ON ci.user_id = m.user_id AND ci.group_id = $1 AND ci.cycle_number = $2 AND ci.status = 'completed'
       WHERE m.group_id = $1 AND m.status = 'approved'
       GROUP BY ci.user_id, u.name, u.profile_picture_url, m.user_id`,
      [groupId, cycleNumber, group.contribution_amount]
    );

    // Autopay status for requesting user
    const autopayRes = await query(
      `SELECT enabled FROM member_autopay WHERE group_id = $1 AND user_id = $2`,
      [groupId, req.user.id]
    );

    // My own progress
    const myProgressRes = await query(
      `SELECT COALESCE(SUM(amount_xaf), 0) as paid
       FROM contribution_installments
       WHERE group_id = $1 AND user_id = $2 AND cycle_number = $3 AND status = 'completed'`,
      [groupId, req.user.id, cycleNumber]
    );
    const myPaid = Number(myProgressRes.rows[0].paid);
    const myTarget = Number(group.contribution_amount);
    const myRemaining = Math.max(0, myTarget - myPaid);

    // Check if early payout banner should show
    // (all members fully paid, payout date not yet reached, I am the current payout recipient)
    let showEarlyPayoutBanner = false;
    let earlyPayoutAmount = 0;
    let currentPayoutId = null;

    if (collected >= target && group.status === 'active') {
      const payoutRes = await query(
        `SELECT id, user_id, amount, payout_date FROM payouts
         WHERE group_id = $1 AND status = 'current' LIMIT 1`,
        [groupId]
      );
      const currentPayout = payoutRes.rows[0];
      if (currentPayout && currentPayout.user_id === req.user.id) {
        const now = new Date();
        const payoutDate = new Date(currentPayout.payout_date);
        if (now < payoutDate) {
          // Check no pending early payout request
          const existingReq = await query(
            `SELECT id FROM early_payout_requests WHERE payout_id = $1 AND status = 'pending'`,
            [currentPayout.id]
          );
          if (!existingReq.rows[0]) {
            showEarlyPayoutBanner = true;
            earlyPayoutAmount = Number(currentPayout.amount) * (1 - EARLY_PAYOUT_FEE);
            currentPayoutId = currentPayout.id;
          }
        }
      }
    }

    // Get current payout date for deadline calculation
    const currentPayoutDateRes = await query(
      `SELECT payout_date FROM payouts WHERE group_id = $1 AND status = 'current' LIMIT 1`,
      [groupId]
    );
    const currentPayoutDate = currentPayoutDateRes.rows[0]?.payout_date || null;
    const deadlineDate = currentPayoutDate && group.deadline_days_before
      ? (() => {
          const d = new Date(currentPayoutDate);
          d.setDate(d.getDate() - (group.deadline_days_before || 2));
          return d;
        })()
      : null;

    res.json({
      success: true,
      data: {
        group_id:      groupId,
        group_name:    group.name,
        cycle_number:  cycleNumber,
        target,
        collected,
        member_count:  memberCount,
        pool_percent:  target > 0 ? Math.round((collected / target) * 100) : 0,
        contribution_amount: Number(group.contribution_amount),
        my_paid:       myPaid,
        my_target:     myTarget,
        my_remaining:  myRemaining,
        my_percent:    myTarget > 0 ? Math.round((myPaid / myTarget) * 100) : 0,
        autopay_enabled: autopayRes.rows[0]?.enabled || false,
        member_progress: memberProgressRes.rows,
        show_early_payout_banner: showEarlyPayoutBanner,
        early_payout_amount: earlyPayoutAmount,
        current_payout_id: currentPayoutId,
        early_payout_fee_percent: EARLY_PAYOUT_FEE * 100,
        deadline_date: deadlineDate,
        payout_date:   currentPayoutDate,
      },
    });
  } catch (error) { next(error); }
};

// ── POST /groups/:id/installment ───────────────────────────────────────────
// Pay a partial contribution installment
const payInstallment = async (req, res, next) => {
  try {
    const { id: groupId } = req.params;
    const { amount_xaf, payment_method } = req.body;

    if (!amount_xaf || amount_xaf <= 0) {
      return res.status(400).json({ success: false, message: 'amount_xaf must be greater than 0' });
    }

    const groupRes = await query('SELECT * FROM groups WHERE id = $1', [groupId]);
    const group = groupRes.rows[0];
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    if (group.status !== 'active') return res.status(400).json({ success: false, message: 'Group is not active' });

    const memberRes = await query(
      `SELECT id FROM members WHERE group_id = $1 AND user_id = $2 AND status = 'approved'`,
      [groupId, req.user.id]
    );
    if (!memberRes.rows[0]) return res.status(403).json({ success: false, message: 'Not a group member' });

    // Current cycle
    const cycleRes = await query(
      `SELECT COALESCE(MAX(cycle_number), 1) as cycle FROM contribution_installments WHERE group_id = $1`,
      [groupId]
    );
    const cycleNumber = Number(cycleRes.rows[0].cycle);

    // How much has this member already paid this cycle?
    const paidRes = await query(
      `SELECT COALESCE(SUM(amount_xaf), 0) as paid
       FROM contribution_installments
       WHERE group_id = $1 AND user_id = $2 AND cycle_number = $3 AND status = 'completed'`,
      [groupId, req.user.id, cycleNumber]
    );
    const alreadyPaid = Number(paidRes.rows[0].paid);
    const remaining   = Number(group.contribution_amount) - alreadyPaid;

    if (remaining <= 0) {
      return res.status(409).json({ success: false, message: 'You have already fully paid your contribution for this cycle' });
    }

    // Prevent overpayment
    if (amount_xaf > remaining) {
      return res.status(400).json({
        success: false,
        message: `Payment of ${amount_xaf.toLocaleString()} XAF exceeds remaining balance of ${remaining.toLocaleString()} XAF`,
        remaining,
      });
    }

    // Process payment
    if (payment_method === 'tc_wallet') {
      const tcAmount = amount_xaf / TC_TO_XAF;
      const walletResult = await walletService.payContribution({
        userId: req.user.id,
        groupId,
        cycleNumber,
        tcAmount,
      });
      if (!walletResult.success) {
        return res.status(400).json({ success: false, message: walletResult.message });
      }
    }
    // For mobile money — in production this would call processPayment
    // For now we record it as completed (mock)

    // Record installment
    await query(
      `INSERT INTO contribution_installments (group_id, user_id, cycle_number, amount_xaf, payment_method, status)
       VALUES ($1, $2, $3, $4, $5, 'completed')`,
      [groupId, req.user.id, cycleNumber, amount_xaf, payment_method || 'tc_wallet']
    );

    const newPaid     = alreadyPaid + amount_xaf;
    const newRemaining = Number(group.contribution_amount) - newPaid;
    const isComplete  = newRemaining <= 0;

    // Notify admin
    const adminRes = await query(`SELECT user_id FROM members WHERE group_id = $1 AND role = 'admin'`, [groupId]);
    if (adminRes.rows[0]) {
      await sendNotificationToUser({
        userId:  adminRes.rows[0].user_id,
        title:   'Installment Received',
        message: `${req.user.name} paid ${amount_xaf.toLocaleString()} XAF installment for "${group.name}"`,
        type:    'contribution',
        groupId,
      });
    }

    // Recalculate trust score
    recalculateTrustScore(req.user.id).catch(() => {});

    // Check if all members have now fully paid → check for auto-disburse
    if (isComplete) {
      await checkAllPaidAndNotify(groupId, cycleNumber, group);
    }

    res.json({
      success: true,
      message: isComplete ? '🎉 Contribution complete!' : `Payment received. ${newRemaining.toLocaleString()} XAF remaining.`,
      data: {
        paid:      newPaid,
        target:    Number(group.contribution_amount),
        remaining: newRemaining,
        percent:   Math.round((newPaid / Number(group.contribution_amount)) * 100),
        is_complete: isComplete,
      },
    });
  } catch (error) { next(error); }
};

// Check if all members fully paid and notify the current payout recipient
const checkAllPaidAndNotify = async (groupId, cycleNumber, group) => {
  try {
    const memberCountRes = await query(
      `SELECT COUNT(*) as total FROM members WHERE group_id = $1 AND status = 'approved'`,
      [groupId]
    );
    const totalMembers = Number(memberCountRes.rows[0].total);

    const fullyPaidRes = await query(
      `SELECT COUNT(DISTINCT user_id) as paid
       FROM (
         SELECT user_id, SUM(amount_xaf) as total_paid
         FROM contribution_installments
         WHERE group_id = $1 AND cycle_number = $2 AND status = 'completed'
         GROUP BY user_id
         HAVING SUM(amount_xaf) >= $3
       ) sub`,
      [groupId, cycleNumber, group.contribution_amount]
    );
    const fullyPaid = Number(fullyPaidRes.rows[0].paid);

    if (fullyPaid < totalMembers) return; // not everyone done yet

    // All paid — check if payout date has passed
    const payoutRes = await query(
      `SELECT id, user_id, amount, payout_date FROM payouts WHERE group_id = $1 AND status = 'current' LIMIT 1`,
      [groupId]
    );
    const payout = payoutRes.rows[0];
    if (!payout) return;

    const now = new Date();
    const payoutDate = new Date(payout.payout_date);

    if (now >= payoutDate) {
      // Payout date reached — disburse automatically
      await processPayout(payout.id);
    } else {
      // Payout date not yet reached — notify recipient of early payout option
      await sendNotificationToUser({
        userId:  payout.user_id,
        title:   '💰 All contributions received!',
        message: `All members have paid their contributions for "${group.name}". Your payout is scheduled for ${payoutDate.toLocaleDateString()}. Open the group to request early payout (0.5% fee) or wait for the full amount.`,
        type:    'group_update',
        groupId,
      });
    }
  } catch (err) {
    logger.error(`[Installment] checkAllPaidAndNotify error: ${err.message}`);
  }
};

// ── POST /groups/:id/early-payout ─────────────────────────────────────────
const requestEarlyPayout = async (req, res, next) => {
  try {
    const { id: groupId } = req.params;
    const { payout_id, accept } = req.body;

    if (!accept) {
      // User rejected — just return success, banner will disappear on frontend
      return res.json({ success: true, message: 'Early payout declined. You will receive the full amount on the scheduled date.' });
    }

    const payoutRes = await query(
      `SELECT * FROM payouts WHERE id = $1 AND group_id = $2 AND user_id = $3 AND status = 'current'`,
      [payout_id, groupId, req.user.id]
    );
    const payout = payoutRes.rows[0];
    if (!payout) return res.status(404).json({ success: false, message: 'Payout not found or not eligible' });

    const fee        = Number(payout.amount) * EARLY_PAYOUT_FEE;
    const netAmount  = Number(payout.amount) - fee;

    // Record the early payout request
    await query(
      `INSERT INTO early_payout_requests (group_id, payout_id, user_id, fee_percent, status)
       VALUES ($1, $2, $3, $4, 'accepted')`,
      [groupId, payout_id, req.user.id, EARLY_PAYOUT_FEE]
    );

    // Process payout with reduced amount
    await query(
      `UPDATE payouts SET amount = $1 WHERE id = $2`,
      [netAmount, payout_id]
    );
    await processPayout(payout_id);

    res.json({
      success: true,
      message: `Early payout of ${netAmount.toLocaleString()} XAF processed (${fee.toLocaleString()} XAF fee deducted).`,
      data: { net_amount: netAmount, fee },
    });
  } catch (error) { next(error); }
};

// ── POST /groups/:id/autopay ───────────────────────────────────────────────
const toggleAutopay = async (req, res, next) => {
  try {
    const { id: groupId } = req.params;
    const { enabled } = req.body;

    await query(
      `INSERT INTO member_autopay (group_id, user_id, enabled, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (group_id, user_id) DO UPDATE SET enabled = $3, updated_at = NOW()`,
      [groupId, req.user.id, enabled]
    );

    res.json({ success: true, message: `Autopay ${enabled ? 'enabled' : 'disabled'}`, data: { enabled } });
  } catch (error) { next(error); }
};

// ── Autopay trigger (called when a new cycle starts) ──────────────────────
const triggerAutopayForGroup = async (groupId) => {
  try {
    const groupRes = await query('SELECT * FROM groups WHERE id = $1', [groupId]);
    const group = groupRes.rows[0];
    if (!group || group.status !== 'active') return;

    const cycleRes = await query(
      `SELECT COALESCE(MAX(cycle_number), 1) as cycle FROM contribution_installments WHERE group_id = $1`,
      [groupId]
    );
    const cycleNumber = Number(cycleRes.rows[0].cycle);

    // Get all members with autopay enabled who haven't fully paid yet
    const autopayRes = await query(
      `SELECT ma.user_id, u.name, u.tc_balance
       FROM member_autopay ma
       JOIN users u ON u.id = ma.user_id
       JOIN members m ON m.user_id = ma.user_id AND m.group_id = $1 AND m.status = 'approved'
       WHERE ma.group_id = $1 AND ma.enabled = TRUE`,
      [groupId]
    );

    for (const member of autopayRes.rows) {
      // Check how much they still owe
      const paidRes = await query(
        `SELECT COALESCE(SUM(amount_xaf), 0) as paid
         FROM contribution_installments
         WHERE group_id = $1 AND user_id = $2 AND cycle_number = $3 AND status = 'completed'`,
        [groupId, member.user_id, cycleNumber]
      );
      const alreadyPaid = Number(paidRes.rows[0].paid);
      const remaining   = Number(group.contribution_amount) - alreadyPaid;

      if (remaining <= 0) continue; // already paid

      const tcNeeded = remaining / TC_TO_XAF;
      const tcBalance = Number(member.tc_balance);

      if (tcBalance >= tcNeeded) {
        // Sufficient balance — auto-pay
        const walletResult = await walletService.payContribution({
          userId: member.user_id,
          groupId,
          cycleNumber,
          tcAmount: tcNeeded,
        });

        if (walletResult.success) {
          await query(
            `INSERT INTO contribution_installments (group_id, user_id, cycle_number, amount_xaf, payment_method, status)
             VALUES ($1, $2, $3, $4, 'tc_wallet', 'completed')`,
            [groupId, member.user_id, cycleNumber, remaining]
          );

          await sendNotificationToUser({
            userId:  member.user_id,
            title:   '✅ Autopay Successful',
            message: `${remaining.toLocaleString()} XAF was automatically deducted from your TC wallet for "${group.name}".`,
            type:    'contribution',
            groupId,
          });

          recalculateTrustScore(member.user_id).catch(() => {});
        }
      } else {
        // Insufficient balance — remind them
        const shortfall = remaining - (tcBalance * TC_TO_XAF);
        await sendNotificationToUser({
          userId:  member.user_id,
          title:   '⚠️ Autopay Failed — Insufficient Balance',
          message: `Autopay for "${group.name}" failed. You need ${remaining.toLocaleString()} XAF but your TC wallet only has ${(tcBalance * TC_TO_XAF).toLocaleString()} XAF. Please top up ${shortfall.toLocaleString()} XAF before the deadline.`,
          type:    'contribution',
          groupId,
        });
      }
    }

    // After autopay, check if all members are now fully paid
    await checkAllPaidAndNotify(groupId, cycleNumber, group);
  } catch (err) {
    logger.error(`[Autopay] triggerAutopayForGroup error for ${groupId}: ${err.message}`);
  }
};

module.exports = { getGroupPool, payInstallment, requestEarlyPayout, toggleAutopay, triggerAutopayForGroup };
