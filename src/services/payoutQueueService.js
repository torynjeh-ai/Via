const { query } = require('../config/database');

/**
 * Turn Allocation Algorithm:
 * 1. Shuffle members randomly
 * 2. Prioritize high trust scores (earlier positions)
 * 3. Ensure invited members are spaced apart (min 2 positions)
 * 4. Save fixed queue
 */
const generatePayoutQueue = async (groupId) => {
  // Get all approved members with their trust scores and invite relationships
  const membersResult = await query(
    `SELECT m.id, m.user_id, m.invited_by, u.name, u.trust_score
     FROM members m
     JOIN users u ON m.user_id = u.id
     WHERE m.group_id = $1 AND m.status = 'approved'
     ORDER BY u.trust_score DESC`,
    [groupId]
  );

  const members = membersResult.rows;
  if (members.length === 0) return [];

  // Sort by trust score with some randomness (weighted shuffle)
  const weighted = members.map(m => ({
    ...m,
    weight: m.trust_score + Math.random() * 30, // Add randomness
  }));
  weighted.sort((a, b) => b.weight - a.weight);

  // Apply spacing constraint for invited members
  const queue = applyInviteSpacing(weighted);

  // Delete existing queue and save new one
  await query('DELETE FROM payouts WHERE group_id = $1 AND status = $2', [groupId, 'upcoming']);

  const group = await query('SELECT contribution_amount, cycle FROM groups WHERE id = $1', [groupId]);
  const { contribution_amount, cycle } = group.rows[0];

  const insertPromises = queue.map(async (member, index) => {
    const payoutDate = calculatePayoutDate(index + 1, cycle);
    await query(
      `INSERT INTO payouts (group_id, user_id, position, amount, status, payout_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (group_id, position) DO UPDATE SET user_id = $2, amount = $4, payout_date = $6`,
      [groupId, member.user_id, index + 1, contribution_amount * members.length, 'upcoming', payoutDate]
    );
  });

  await Promise.all(insertPromises);

  // Set first position as current
  await query(
    `UPDATE payouts SET status = 'current' WHERE group_id = $1 AND position = 1`,
    [groupId]
  );

  return queue;
};

const applyInviteSpacing = (members) => {
  const result = [...members];
  const MIN_SPACING = 2;

  for (let i = 0; i < result.length; i++) {
    const current = result[i];
    if (!current.invited_by) continue;

    // Find the inviter's position
    const inviterIndex = result.findIndex(m => m.user_id === current.invited_by);
    if (inviterIndex === -1) continue;

    // Check if they're too close
    const distance = Math.abs(i - inviterIndex);
    if (distance < MIN_SPACING) {
      // Move current member further away
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

module.exports = { generatePayoutQueue };
