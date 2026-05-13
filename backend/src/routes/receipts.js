const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/database');
const { generateContributionReceipt, generatePayoutReceipt, generateWalletReceipt, generateSavingsReceipt, generateSavingsWithdrawalReceipt } = require('../services/receiptService');

const router = Router();
router.use(authenticate);

// GET /receipts/history — all transactions for the current user
router.get('/history', async (req, res, next) => {
  try {
    const [contributions, payouts, walletTxns, savingsDeposits, savingsWithdrawals] = await Promise.all([
      query(
        `SELECT c.id, c.amount, c.cycle_number, c.payment_method, c.transaction_id,
                c.status, c.paid_at, c.created_at,
                g.name AS group_name, g.cycle AS group_cycle
         FROM contributions c
         JOIN groups g ON c.group_id = g.id
         WHERE c.user_id = $1 AND c.status = 'completed'
         ORDER BY c.paid_at DESC`,
        [req.user.id]
      ),
      query(
        `SELECT p.id, p.amount, p.position, p.status, p.payout_date, p.paid_at, p.transaction_id,
                g.name AS group_name, g.cycle AS group_cycle
         FROM payouts p
         JOIN groups g ON p.group_id = g.id
         WHERE p.user_id = $1 AND p.status = 'completed'
         ORDER BY p.paid_at DESC`,
        [req.user.id]
      ),
      query(
        `SELECT wt.id, wt.type, wt.tc_amount, wt.xaf_amount, wt.payment_method,
                wt.status, wt.created_at,
                ru.name AS counterparty_name
         FROM wallet_transactions wt
         LEFT JOIN users ru ON wt.counterparty_user_id = ru.id
         WHERE wt.user_id = $1 AND wt.status = 'completed'
           AND wt.type IN ('top_up', 'withdrawal', 'transfer_out', 'transfer_in')
         ORDER BY wt.created_at DESC`,
        [req.user.id]
      ),
      query(
        `SELECT sd.id, sd.amount_xaf, sd.payment_method, sd.transaction_id, sd.created_at,
                sg.name AS goal_name, sg.category
         FROM savings_deposits sd
         JOIN savings_goals sg ON sd.goal_id = sg.id
         WHERE sd.user_id = $1
         ORDER BY sd.created_at DESC`,
        [req.user.id]
      ),
      query(
        `SELECT sw.id, sw.net_amount_xaf, sw.fee_xaf, sw.withdrawal_method, sw.created_at,
                sg.name AS goal_name, sg.category
         FROM savings_withdrawals sw
         JOIN savings_goals sg ON sw.goal_id = sg.id
         WHERE sw.user_id = $1
         ORDER BY sw.created_at DESC`,
        [req.user.id]
      ),
    ]);

    const typeLabels = {
      top_up:       'Deposit',
      withdrawal:   'Withdrawal',
      transfer_out: 'Transfer Sent',
      transfer_in:  'Transfer Received',
    };

    const history = [
      ...contributions.rows.map(c => ({
        id: c.id,
        type: 'contribution',
        receipt_number: `RCP-${c.id.substring(0, 8).toUpperCase()}`,
        amount: Number(c.amount),
        group_name: c.group_name,
        group_cycle: c.group_cycle,
        payment_method: c.payment_method,
        transaction_id: c.transaction_id,
        cycle_number: c.cycle_number,
        date: c.paid_at || c.created_at,
      })),
      ...payouts.rows.map(p => ({
        id: p.id,
        type: 'payout',
        receipt_number: `PAY-${p.id.substring(0, 8).toUpperCase()}`,
        amount: Number(p.amount),
        group_name: p.group_name,
        group_cycle: p.group_cycle,
        position: p.position,
        transaction_id: p.transaction_id,
        date: p.paid_at || p.payout_date,
      })),
      ...walletTxns.rows.map(t => ({
        id: t.id,
        type: t.type,
        label: typeLabels[t.type] || t.type,
        receipt_number: `TXN-${t.id.substring(0, 8).toUpperCase()}`,
        amount: Number(t.xaf_amount) || Number(t.tc_amount) * 10000,
        payment_method: t.payment_method,
        counterparty_name: t.counterparty_name,
        date: t.created_at,
      })),
      ...savingsDeposits.rows.map(s => ({
        id: s.id,
        type: 'savings_deposit',
        label: 'Savings Deposit',
        receipt_number: `SAV-${s.id.substring(0, 8).toUpperCase()}`,
        amount: Number(s.amount_xaf),
        goal_name: s.goal_name,
        category: s.category,
        payment_method: s.payment_method,
        transaction_id: s.transaction_id,
        date: s.created_at,
      })),
      ...savingsWithdrawals.rows.map(s => ({
        id: s.id,
        type: 'savings_withdrawal',
        label: 'Savings Withdrawal',
        receipt_number: `SWD-${s.id.substring(0, 8).toUpperCase()}`,
        amount: Number(s.net_amount_xaf),
        goal_name: s.goal_name,
        category: s.category,
        payment_method: s.withdrawal_method,
        date: s.created_at,
      })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({ success: true, data: history });
  } catch (error) { next(error); }
});

// GET /receipts/contribution/:id
router.get('/contribution/:id', async (req, res, next) => {
  try {
    const check = await query(
      `SELECT id FROM contributions WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!check.rows[0]) return res.status(403).json({ success: false, message: 'Receipt not found or access denied' });
    const receipt = await generateContributionReceipt(req.params.id);
    if (!receipt) return res.status(404).json({ success: false, message: 'Receipt not found' });
    res.json({ success: true, data: receipt });
  } catch (error) { next(error); }
});

// GET /receipts/payout/:id
router.get('/payout/:id', async (req, res, next) => {
  try {
    const check = await query(
      `SELECT id FROM payouts WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!check.rows[0]) return res.status(403).json({ success: false, message: 'Receipt not found or access denied' });
    const receipt = await generatePayoutReceipt(req.params.id);
    if (!receipt) return res.status(404).json({ success: false, message: 'Receipt not found' });
    res.json({ success: true, data: receipt });
  } catch (error) { next(error); }
});

// GET /receipts/transaction/:id — wallet transaction receipt
router.get('/transaction/:id', async (req, res, next) => {
  try {
    const receipt = await generateWalletReceipt(req.params.id, req.user.id);
    if (!receipt) return res.status(404).json({ success: false, message: 'Receipt not found or access denied' });
    res.json({ success: true, data: receipt });
  } catch (error) { next(error); }
});

// GET /receipts/savings/:id — savings deposit receipt
router.get('/savings/:id', async (req, res, next) => {
  try {
    const receipt = await generateSavingsReceipt(req.params.id, req.user.id);
    if (!receipt) return res.status(404).json({ success: false, message: 'Receipt not found or access denied' });
    res.json({ success: true, data: receipt });
  } catch (error) { next(error); }
});

// GET /receipts/savings-withdrawal/:id — savings withdrawal receipt
router.get('/savings-withdrawal/:id', async (req, res, next) => {
  try {
    const receipt = await generateSavingsWithdrawalReceipt(req.params.id, req.user.id);
    if (!receipt) return res.status(404).json({ success: false, message: 'Receipt not found or access denied' });
    res.json({ success: true, data: receipt });
  } catch (error) { next(error); }
});

module.exports = router;
