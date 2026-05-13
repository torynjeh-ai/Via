/**
 * Contribution Reminder & Late Penalty Notification Service
 *
 * Sends reminders to members who haven't contributed yet.
 * Schedule:
 *   - Weekly groups:  2x per week (every 3-4 days)
 *   - Biweekly groups: every 3 days
 *   - Monthly groups: 4x per month (every ~7 days)
 *
 * Also sends:
 *   - 3 days before deadline
 *   - 1 day before deadline
 *   - On deadline day
 *   - Daily after deadline (penalty period) until paid
 *
 * Stops sending once a member has contributed for the current cycle.
 */

const { query } = require('../config/database');
const { sendNotificationToUser } = require('./notificationService');
const logger = require('../utils/logger');

const PLATFORM_FEE_PERCENT = 4; // 4% of penalty goes to platform

/**
 * Calculate the contribution deadline for a group's current payout.
 * Deadline = current payout date - deadline_days_before
 */
const getDeadlineForGroup = (payoutDate, deadlineDaysBefore) => {
  const deadline = new Date(payoutDate);
  deadline.setDate(deadline.getDate() - deadlineDaysBefore);
  deadline.setHours(23, 59, 59, 999);
  return deadline;
};

/**
 * Check if a contribution is late (after the deadline).
 */
const isLateContribution = (payoutDate, deadlineDaysBefore) => {
  const now = new Date();
  const deadline = getDeadlineForGroup(payoutDate, deadlineDaysBefore);
  return now > deadline;
};

/**
 * Calculate penalty amount for a late contribution.
 */
const calculatePenalty = (contributionAmount, penaltyType, penaltyValue) => {
  if (penaltyType === 'percent') {
    return Math.round((contributionAmount * penaltyValue) / 100);
  }
  return penaltyValue; // fixed amount
};

/**
 * Distribute penalty pool to all members equally (excluding the late payer),
 * minus platform fee. Platform takes 4%, rest split equally among other members.
 */
const distributePenaltyPool = async (groupId, cycleNumber, totalPenaltyXaf, excludeUserId) => {
  if (totalPenaltyXaf <= 0) return;

  const platformFeeXaf = Math.round(totalPenaltyXaf * PLATFORM_FEE_PERCENT / 100);
  const memberPoolXaf  = totalPenaltyXaf - platformFeeXaf;

  // Exclude the late payer from receiving the distribution
  const membersRes = await query(
    `SELECT user_id FROM members WHERE group_id = $1 AND status = 'approved' AND user_id != $2`,
    [groupId, excludeUserId]
  );
  const members = membersRes.rows;
  if (members.length === 0) return;

  const sharePerMemberXaf = Math.floor(memberPoolXaf / members.length);
  const sharePerMemberTc  = sharePerMemberXaf / 10000;

  // Credit each member's wallet
  const walletService = require('./walletService');
  await Promise.all(members.map(m =>
    walletService.creditPenaltyShare({
      userId:  m.user_id,
      groupId,
      xafAmount: sharePerMemberXaf,
    }).catch(err => logger.error(`[Penalty] Failed to credit ${m.user_id}: ${err.message}`))
  ));

  // Record the distribution
  await query(
    `INSERT INTO penalty_distributions (group_id, cycle_number, total_penalty, platform_fee, member_share)
     VALUES ($1, $2, $3, $4, $5)`,
    [groupId, cycleNumber, totalPenaltyXaf, platformFeeXaf, sharePerMemberXaf]
  );

  // Notify members of their penalty share
  await Promise.all(members.map(m =>
    sendNotificationToUser({
      userId:  m.user_id,
      title:   'Penalty Share Received',
      message: `You received ${sharePerMemberXaf.toLocaleString()} XAF (${sharePerMemberTc.toFixed(4)} TC) as your share of a late contribution penalty in your group.`,
      type:    'group_update',
      groupId,
    }).catch(() => {})
  ));

  logger.info(`[Penalty] Distributed ${totalPenaltyXaf} XAF — platform: ${platformFeeXaf} XAF, each member: ${sharePerMemberXaf} XAF`);
};

/**
 * Send contribution reminders to all members who haven't paid yet.
 * Called by a scheduled job (see scheduleReminders).
 */
const sendRemindersForGroup = async (group) => {
  const {
    id: groupId, name, cycle,
    deadline_days_before, late_penalty_type, late_penalty_value,
  } = group;

  // Get current payout date
  const currentPayoutRes = await query(
    `SELECT payout_date FROM payouts WHERE group_id = $1 AND status = 'current' LIMIT 1`,
    [groupId]
  );
  if (!currentPayoutRes.rows[0]?.payout_date) return;

  const payoutDate = new Date(currentPayoutRes.rows[0].payout_date);
  const deadline   = getDeadlineForGroup(payoutDate, deadline_days_before);
  const now        = new Date();
  const daysToDeadline = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
  const isLate     = now > deadline;

  // Determine current cycle number
  const cycleRes = await query(
    `SELECT COALESCE(MAX(cycle_number), 0) + 1 as cycle FROM contributions WHERE group_id = $1`,
    [groupId]
  );
  const cycleNumber = cycleRes.rows[0].cycle;

  // Get members who haven't contributed this cycle yet
  const unpaidRes = await query(
    `SELECT m.user_id, u.name FROM members m
     JOIN users u ON m.user_id = u.id
     WHERE m.group_id = $1 AND m.status = 'approved'
     AND m.user_id NOT IN (
       SELECT user_id FROM contributions
       WHERE group_id = $1 AND cycle_number = $2 AND status = 'completed'
     )`,
    [groupId, cycleNumber]
  );

  if (unpaidRes.rows.length === 0) return; // everyone has paid

  const penaltyAmount = calculatePenalty(group.contribution_amount, late_penalty_type, late_penalty_value);

  for (const member of unpaidRes.rows) {
    let title, message;

    if (isLate) {
      title   = '⚠️ Late Contribution — Penalty Applies';
      message = `You haven't contributed to "${name}" yet. The deadline has passed. A penalty of ${penaltyAmount.toLocaleString()} XAF will be added to your contribution. Please pay as soon as possible.`;
    } else if (daysToDeadline === 0) {
      title   = '🔔 Last Day to Contribute!';
      message = `Today is the last day to contribute to "${name}" without a penalty. Contribute now to avoid a ${penaltyAmount.toLocaleString()} XAF late fee.`;
    } else if (daysToDeadline === 1) {
      title   = '⏰ Contribution Due Tomorrow';
      message = `Your contribution to "${name}" is due tomorrow. Pay before the deadline to avoid a ${penaltyAmount.toLocaleString()} XAF late penalty.`;
    } else if (daysToDeadline === 3) {
      title   = '📅 Contribution Reminder';
      message = `Reminder: your contribution to "${name}" is due in 3 days (${deadline.toLocaleDateString()}). Late contributions incur a ${penaltyAmount.toLocaleString()} XAF penalty.`;
    } else {
      title   = '📅 Contribution Reminder';
      message = `Don't forget to contribute to "${name}". Deadline: ${deadline.toLocaleDateString()}. Late fee: ${penaltyAmount.toLocaleString()} XAF.`;
    }

    await sendNotificationToUser({
      userId:  member.user_id,
      title,
      message,
      type:    'contribution',
      groupId,
    }).catch(() => {});
  }

  logger.info(`[Reminders] Sent to ${unpaidRes.rows.length} unpaid members in group "${name}" (${daysToDeadline} days to deadline, late=${isLate})`);
};

/**
 * Main scheduler — runs periodically (call this from a cron job or setInterval).
 * Determines which groups need reminders based on their cycle frequency.
 */
const runReminderScheduler = async () => {
  try {
    const groupsRes = await query(
      `SELECT g.*, g.contribution_amount FROM groups g
       WHERE g.status = 'active'`,
    );

    const now = new Date();
    const dayOfWeek  = now.getDay();   // 0=Sun, 1=Mon, ..., 6=Sat
    const dayOfMonth = now.getDate();

    for (const group of groupsRes.rows) {
      const { cycle } = group;

      // Get current payout date to check deadline proximity
      const payoutRes = await query(
        `SELECT payout_date FROM payouts WHERE group_id = $1 AND status = 'current' LIMIT 1`,
        [group.id]
      );
      if (!payoutRes.rows[0]?.payout_date) continue;

      const payoutDate     = new Date(payoutRes.rows[0].payout_date);
      const deadline       = getDeadlineForGroup(payoutDate, group.deadline_days_before);
      const daysToDeadline = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
      const isLate         = now > deadline;

      // Always send on critical days regardless of cycle
      const isCriticalDay = isLate || daysToDeadline <= 3;

      // Frequency-based schedule
      let shouldSend = isCriticalDay;

      if (!shouldSend) {
        if (cycle === 'weekly') {
          // 2x per week: Monday (1) and Thursday (4)
          shouldSend = dayOfWeek === 1 || dayOfWeek === 4;
        } else if (cycle === 'biweekly') {
          // Every 3-4 days: Mon (1), Thu (4), Sun (0)
          shouldSend = dayOfWeek === 1 || dayOfWeek === 4;
        } else if (cycle === 'monthly') {
          // 4x per month: 1st, 8th, 15th, 22nd
          shouldSend = [1, 8, 15, 22].includes(dayOfMonth);
        }
      }

      if (shouldSend) {
        await sendRemindersForGroup(group).catch(err =>
          logger.error(`[Reminders] Error for group ${group.id}: ${err.message}`)
        );
      }
    }
  } catch (err) {
    logger.error(`[Reminders] Scheduler error: ${err.message}`);
  }
};

module.exports = {
  isLateContribution,
  calculatePenalty,
  distributePenaltyPool,
  sendRemindersForGroup,
  runReminderScheduler,
  getDeadlineForGroup,
  PLATFORM_FEE_PERCENT,
};
