const { query } = require('../config/database');

/**
 * Generate a receipt for a contribution
 */
const generateContributionReceipt = async (contributionId) => {
  const result = await query(
    `SELECT 
       c.id,
       c.amount,
       c.cycle_number,
       c.payment_method,
       c.transaction_id,
       c.status,
       c.paid_at,
       c.created_at,
       u.name AS member_name,
       u.phone AS member_phone,
       g.name AS group_name,
       g.cycle AS group_cycle,
       g.contribution_amount
     FROM contributions c
     JOIN users u ON c.user_id = u.id
     JOIN groups g ON c.group_id = g.id
     WHERE c.id = $1`,
    [contributionId]
  );

  const c = result.rows[0];
  if (!c) return null;

  return {
    receipt_type: 'contribution',
    receipt_number: `RCP-${c.id.substring(0, 8).toUpperCase()}`,
    transaction_id: c.transaction_id,
    status: c.status,
    issued_at: c.paid_at || c.created_at,
    member: {
      name: c.member_name,
      phone: c.member_phone,
    },
    group: {
      name: c.group_name,
      cycle: c.group_cycle,
    },
    payment: {
      amount: Number(c.amount),
      currency: 'XAF',
      method: formatPaymentMethod(c.payment_method),
      cycle_number: c.cycle_number,
    },
  };
};

/**
 * Generate a receipt for a payout
 */
const generatePayoutReceipt = async (payoutId) => {
  const result = await query(
    `SELECT 
       p.id,
       p.amount,
       p.position,
       p.status,
       p.payout_date,
       p.paid_at,
       p.transaction_id,
       u.name AS member_name,
       u.phone AS member_phone,
       g.name AS group_name,
       g.cycle AS group_cycle,
       g.contribution_amount,
       (SELECT COUNT(*) FROM members m WHERE m.group_id = g.id AND m.status = 'approved') AS member_count
     FROM payouts p
     JOIN users u ON p.user_id = u.id
     JOIN groups g ON p.group_id = g.id
     WHERE p.id = $1`,
    [payoutId]
  );

  const p = result.rows[0];
  if (!p) return null;

  return {
    receipt_type: 'payout',
    receipt_number: `PAY-${p.id.substring(0, 8).toUpperCase()}`,
    transaction_id: p.transaction_id,
    status: p.status,
    issued_at: p.paid_at || p.payout_date || new Date(),
    member: {
      name: p.member_name,
      phone: p.member_phone,
    },
    group: {
      name: p.group_name,
      cycle: p.group_cycle,
      member_count: Number(p.member_count),
    },
    payout: {
      amount: Number(p.amount),
      currency: 'XAF',
      position: p.position,
      payout_date: p.payout_date,
    },
  };
};

const formatPaymentMethod = (method) => {
  const map = { mtn_momo: 'MTN Mobile Money', orange_money: 'Orange Money' };
  return map[method] || method;
};

module.exports = { generateContributionReceipt, generatePayoutReceipt };
