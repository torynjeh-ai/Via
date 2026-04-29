const { query } = require('../config/database');
const walletService = require('./walletService');

const generatePayoutQueue = async (groupId) => {
  const membersResult = await query(
    `SELECT m.id, m.user_id, m.invited_by, u.name, u.tc_balance
     FROM members m JOIN users u ON m.user_id = u.id
     WHERE m.group_id = $1 AND m.status = 'approved'
     ORDER BY u.tc_balance DESC`,
    [groupId]
  );
  const members = membersResult.rows;
  if (members.length === 0) return [];

  const weighted = members.map(m => ({ ...m, weight: m.tc_balance + Math.random() * 30 }));
  weighted.sort((a, b) => b.weight - a.weight);
  const queue = applyInviteSpacing(weighted);

  await query('DELETE FROM payouts WHERE group_id = $1 AND status = $2', [groupId, 'upcoming']);

  const group = await query('SELECT contribution_amount, cycle FROM groups WHERE id = $1', [groupId]);
  const { contribution_amount, cycle } = group.rows[0];

  await Promise.all(queue.map(async (member, index) => {
    const payoutDate = calculatePayoutDate(index + 1, cycle);
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
    `SELECT p.*, g.name as group_name FROM payouts p
     JOIN groups g ON p.group_id = g.id
     WHERE p.id = $1`,
    [payoutId]
  );
  const payout = payoutRes.rows[0];
  if (!payout) throw new Error(`Payout ${payoutId} not found`);

  // Mark payout as completed
  await query(
    `UPDATE payouts SET status = 'completed', paid_at = NOW() WHERE id = $1`,
    [payoutId]
  );

  // Credit recipient's TC wallet
  await walletService.creditPayout({
    userId: payout.user_id,
    groupId: payout.group_id,
    payoutId: payout.id,
    xafAmount: parseFloat(payout.amount),
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

const calculatePayoutDate = (position, cycle) => {
  const date = new Date();
  const daysPerCycle = cycle === 'weekly' ? 7 : cycle === 'biweekly' ? 14 : 30;
  date.setDate(date.getDate() + (position - 1) * daysPerCycle);
  return date;
};

module.exports = { generatePayoutQueue, processPayout };
