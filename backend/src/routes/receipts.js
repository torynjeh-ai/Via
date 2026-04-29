const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/database');
const { generateContributionReceipt, generatePayoutReceipt } = require('../services/receiptService');

const router = Router();
router.use(authenticate);

// GET /receipts/history — all contributions and payouts for the current user
router.get('/history', async (req, res, next) => {
  try {
    const [contributions, payouts] = await Promise.all([
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
    ]);

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
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({ success: true, data: history });
  } catch (error) { next(error); }
});
router.get('/contribution/:id', async (req, res, next) => {
  try {
    // Ensure the contribution belongs to the requesting user
    const check = await query(
      `SELECT id FROM contributions WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!check.rows[0]) {
      return res.status(403).json({ success: false, message: 'Receipt not found or access denied' });
    }

    const receipt = await generateContributionReceipt(req.params.id);
    if (!receipt) return res.status(404).json({ success: false, message: 'Receipt not found' });

    res.json({ success: true, data: receipt });
  } catch (error) { next(error); }
});

// GET /receipts/payout/:id
router.get('/payout/:id', async (req, res, next) => {
  try {
    // Ensure the payout belongs to the requesting user
    const check = await query(
      `SELECT id FROM payouts WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!check.rows[0]) {
      return res.status(403).json({ success: false, message: 'Receipt not found or access denied' });
    }

    const receipt = await generatePayoutReceipt(req.params.id);
    if (!receipt) return res.status(404).json({ success: false, message: 'Receipt not found' });

    res.json({ success: true, data: receipt });
  } catch (error) { next(error); }
});

module.exports = router;
