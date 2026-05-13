const { query } = require('../config/database');
const walletService = require('./walletService');

const generatePayoutQueue = async (groupId) => {
  const membersResult = await query(
    `SELECT m.id, m.user_id, m.invited_by, u.name, u.tc_balance, u.trust_score
     FROM members m JOIN users u ON m.user_id = u.id
     WHERE m.group_id = $1 AND m.status = 'approved'
     ORDER BY u.trust_score DESC`,
    [groupId]
  );
  const members = membersResult.rows;
  if (members.length === 0) return [];

  // Weight by trust score (0–100) + randomness so it's not fully deterministic
  const weighted = members.map(m => ({ ...m, weight: (m.trust_score || 0) + Math.random() * 20 }));
  weighted.sort((a, b) => b.weight - a.weight);
  const queue = applyInviteSpacing(weighted);

  await query('DELETE FROM payouts WHERE group_id = $1 AND status = $2', [groupId, 'upcoming']);

  const group = await query('SELECT contribution_amount, cycle, start_date FROM groups WHERE id = $1', [groupId]);
  const { contribution_amount, cycle, start_date } = group.rows[0];

  await Promise.all(queue.map(async (member, index) => {
    const payoutDate = calculatePayoutDate(index + 1, cycle, start_date);
    await query(
      `INSERT INTO payouts (group_id, user_id, position, amount, status, payout_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (group_id, position) DO UPDATE SET user_id = $2, amount = $4, payout_date = $6`,
      [groupId, member.user_id, index + 1, contribution_amount * members.length, 'upcoming', payoutDate]
    );
  }));

  await query(`UPDATE payouts SET status = 'current' WHERE group_id = $1 AND position = 1`, [groupId]);
  return queue;
};

/**
 * Process a payout disbursement for the current payout recipient.
 * Marks the payout as completed and credits the recipient's TC wallet.
 * @param {string} payoutId - UUID of the payout to process
 */
const processPayout = async (payoutId) => {
  const payoutRes = await query(
    `SELECT p.*, g.name as group_name, g.status as group_status FROM payouts p
     JOIN groups g ON p.group_id = g.id
     WHERE p.id = $1`,
    [payoutId]
  );
  const payout = payoutRes.rows[0];
  if (!payout) throw new Error(`Payout ${payoutId} not found`);
  if (payout.status === 'completed') throw new Error('Payout already processed');
  if (payout.group_status !== 'active') throw new Error('Group is not active');

  // Mark payout as completed
  await query(
    `UPDATE payouts SET status = 'completed', paid_at = NOW() WHERE id = $1`,
    [payoutId]
  );

  // Advance the next payout to 'current'
  await query(
    `UPDATE payouts SET status = 'current'
     WHERE group_id = $1 AND status = 'upcoming'
     AND position = (
       SELECT MIN(position) FROM payouts WHERE group_id = $1 AND status = 'upcoming'
     )`,
    [payout.group_id]
  );

  // Credit recipient's TC wallet
  await walletService.creditPayout({
    userId: payout.user_id,
    groupId: payout.group_id,
    payoutId: payout.id,
    xafAmount: parseFloat(payout.amount),
  });

  // Notify the recipient
  const { sendNotificationToUser } = require('./notificationService');
  await sendNotificationToUser({
    userId: payout.user_id,
    title: 'Payout Received!',
    message: `You have received your payout of ${Number(payout.amount).toLocaleString()} XAF from "${payout.group_name}".`,
    type: 'group_update',
    groupId: payout.group_id,
  });

  return payout;
};

const applyInviteSpacing = (members) => {
  const result = [...members];
  const MIN_SPACING = 2;
  for (let i = 0; i < result.length; i++) {
    const current = result[i];
    if (!current.invited_by) continue;
    const inviterIndex = result.findIndex(m => m.user_id === current.invited_by);
    if (inviterIndex === -1) continue;
    const distance = Math.abs(i - inviterIndex);
    if (distance < MIN_SPACING) {
      const targetIndex = Math.min(inviterIndex + MIN_SPACING, result.length - 1);
      if (targetIndex !== i) {
        result.splice(i, 1);
        result.splice(targetIndex, 0, current);
      }
    }
  }
  return result;
};

const calculatePayoutDate = (position, cycle, startDate) => {
  // Base from the group's configured start_date, falling back to today
  const base = startDate ? new Date(startDate) : new Date();
  const daysPerCycle = cycle === 'weekly' ? 7 : cycle === 'biweekly' ? 14 : 30;
  const date = new Date(base);
  date.setDate(base.getDate() + (position - 1) * daysPerCycle);
  return date;
};

/**
 * Check if all payouts in a group are completed.
 * If so, automatically end the circle and move the group to re-forming.
 */
const checkAndAutoCompleteCircle = async (groupId) => {
  const groupRes = await query('SELECT * FROM groups WHERE id = $1', [groupId]);
  const group = groupRes.rows[0];
  if (!group || group.status !== 'active') return;

  // Check all payouts are completed
  const payoutRes = await query(
    `SELECT COUNT(*) as total,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
     FROM payouts WHERE group_id = $1`,
    [groupId]
  );
  const { total, completed } = payoutRes.rows[0];
  if (Number(total) === 0 || Number(completed) < Number(total)) return;

  // All payouts done — auto-end the circle
  await query(
    `UPDATE groups SET status = 're-forming', circle_number = circle_number + 1,
     re_forming_since = NOW(), updated_at = NOW() WHERE id = $1`,
    [groupId]
  );

  await query(
    `UPDATE members SET status = 'pending_reconfirm' WHERE group_id = $1 AND status = 'approved'`,
    [groupId]
  );

  const membersRes = await query(
    `SELECT user_id FROM members WHERE group_id = $1 AND status = 'pending_reconfirm'`,
    [groupId]
  );

  const { sendNotificationToUser } = require('./notificationService');
  await Promise.all(membersRes.rows.map(m => sendNotificationToUser({
    userId: m.user_id,
    title: 'Circle Complete!',
    message: `Circle ${group.circle_number} of "${group.name}" is complete — everyone has contributed and received their payout! Re-confirm to join the next circle.`,
    type: 'group_update',
    groupId,
  })));
};

module.exports = { generatePayoutQueue, processPayout, checkAndAutoCompleteCircle };
