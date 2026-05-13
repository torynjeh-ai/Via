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
  const map = {
    mtn_momo:     'MTN Mobile Money',
    orange_money: 'Orange Money',
    tc_wallet:    'TC Wallet',
    bank_transfer:'Bank Transfer',
    card:         'Card',
  };
  return map[method] || method || '—';
};

/**
 * Generate a receipt for a wallet transaction (deposit, withdrawal, transfer)
 */
const generateWalletReceipt = async (transactionId, userId) => {
  const result = await query(
    `SELECT
       wt.id, wt.type, wt.tc_amount, wt.xaf_amount, wt.fee_tc,
       wt.payment_method, wt.status, wt.created_at,
       u.name AS user_name, u.phone AS user_phone,
       ru.name AS counterparty_name, ru.phone AS counterparty_phone
     FROM wallet_transactions wt
     JOIN users u ON wt.user_id = u.id
     LEFT JOIN users ru ON wt.counterparty_user_id = ru.id
     WHERE wt.id = $1 AND wt.user_id = $2`,
    [transactionId, userId]
  );

  const t = result.rows[0];
  if (!t) return null;

  const typeLabels = {
    top_up:       'Deposit',
    withdrawal:   'Withdrawal',
    transfer_out: 'Transfer Sent',
    transfer_in:  'Transfer Received',
    contribution: 'Group Contribution',
    payout:       'Group Payout',
  };

  const xafAmount = Number(t.xaf_amount) || Number(t.tc_amount) * 10000;
  const feeTc     = Number(t.fee_tc) || 0;
  const feeXaf    = feeTc * 10000;

  return {
    receipt_type:   t.type,
    receipt_number: `TXN-${t.id.substring(0, 8).toUpperCase()}`,
    transaction_id: t.id,
    status:         t.status,
    issued_at:      t.created_at,
    user: {
      name:  t.user_name,
      phone: t.user_phone,
    },
    counterparty: t.counterparty_name ? {
      name:  t.counterparty_name,
      phone: t.counterparty_phone,
    } : null,
    payment: {
      type:        t.type,
      label:       typeLabels[t.type] || t.type,
      amount_xaf:  xafAmount,
      amount_tc:   Number(t.tc_amount),
      fee_xaf:     feeXaf,
      net_xaf:     xafAmount - feeXaf,
      currency:    'XAF',
      method:      formatPaymentMethod(t.payment_method),
    },
  };
};

module.exports = { generateContributionReceipt, generatePayoutReceipt, generateWalletReceipt, generateSavingsReceipt, generateSavingsWithdrawalReceipt };

/**
 * Generate a receipt for a savings deposit or withdrawal
 */
async function generateSavingsReceipt(depositId, userId) {
  const result = await query(
    `SELECT
       sd.id, sd.amount_xaf, sd.payment_method, sd.transaction_id, sd.created_at,
       sg.name AS goal_name, sg.category, sg.target_amount, sg.saved_amount, sg.status AS goal_status,
       u.name AS user_name, u.phone AS user_phone
     FROM savings_deposits sd
     JOIN savings_goals sg ON sd.goal_id = sg.id
     JOIN users u ON sd.user_id = u.id
     WHERE sd.id = $1 AND sd.user_id = $2`,
    [depositId, userId]
  );

  const d = result.rows[0];
  if (!d) return null;

  return {
    receipt_type:   'savings_deposit',
    receipt_number: `SAV-${d.id.substring(0, 8).toUpperCase()}`,
    transaction_id: d.transaction_id,
    status:         'completed',
    issued_at:      d.created_at,
    user: {
      name:  d.user_name,
      phone: d.user_phone,
    },
    savings: {
      goal_name:     d.goal_name,
      category:      d.category,
      amount_xaf:    Number(d.amount_xaf),
      currency:      'XAF',
      method:        formatPaymentMethod(d.payment_method),
      target_amount: Number(d.target_amount),
      saved_amount:  Number(d.saved_amount),
      goal_status:   d.goal_status,
    },
  };
}

/**
 * Generate a receipt for a savings withdrawal
 */
async function generateSavingsWithdrawalReceipt(withdrawalId, userId) {
  const result = await query(
    `SELECT
       sw.id, sw.gross_amount_xaf, sw.fee_xaf, sw.net_amount_xaf,
       sw.withdrawal_method, sw.created_at,
       sg.name AS goal_name, sg.category, sg.target_amount,
       u.name AS user_name, u.phone AS user_phone
     FROM savings_withdrawals sw
     JOIN savings_goals sg ON sw.goal_id = sg.id
     JOIN users u ON sw.user_id = u.id
     WHERE sw.id = $1 AND sw.user_id = $2`,
    [withdrawalId, userId]
  );

  const w = result.rows[0];
  if (!w) return null;

  return {
    receipt_type:   'savings_withdrawal',
    receipt_number: `SWD-${w.id.substring(0, 8).toUpperCase()}`,
    transaction_id: w.id,
    status:         'completed',
    issued_at:      w.created_at,
    user: {
      name:  w.user_name,
      phone: w.user_phone,
    },
    savings: {
      goal_name:        w.goal_name,
      category:         w.category,
      gross_amount_xaf: Number(w.gross_amount_xaf),
      fee_xaf:          Number(w.fee_xaf),
      net_amount_xaf:   Number(w.net_amount_xaf),
      currency:         'XAF',
      method:           formatPaymentMethod(w.withdrawal_method),
      target_amount:    Number(w.target_amount),
    },
  };
}
