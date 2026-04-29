const { body } = require('express-validator');
const { query } = require('../config/database');
const { validate } = require('../middleware/validate');
const { processPayment } = require('../services/paymentService');
const { sendNotificationToUser } = require('../services/notificationService');

// POST /groups/:id/contribute
const contribute = [
  body('payment_method').isIn(['mtn_momo', 'orange_money']).withMessage('Invalid payment method'),
  validate,
  async (req, res, next) => {
    try {
      const { id: groupId } = req.params;
      const { payment_method } = req.body;

      const groupRes = await query('SELECT * FROM groups WHERE id = $1', [groupId]);
      const group = groupRes.rows[0];
      if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
      if (group.status !== 'active') return res.status(400).json({ success: false, message: 'Group is not active' });

      const memberRes = await query(
        `SELECT * FROM members WHERE group_id = $1 AND user_id = $2 AND status = 'approved'`,
        [groupId, req.user.id]
      );
      if (!memberRes.rows[0]) return res.status(403).json({ success: false, message: 'Not a group member' });

      // Get current cycle
      const cycleRes = await query(
        `SELECT COALESCE(MAX(cycle_number), 0) + 1 as cycle FROM contributions WHERE group_id = $1`,
        [groupId]
      );
      const cycleNumber = cycleRes.rows[0].cycle;

      // Check already paid this cycle
      const paidRes = await query(
        `SELECT id FROM contributions WHERE group_id = $1 AND user_id = $2 AND cycle_number = $3 AND status = 'completed'`,
        [groupId, req.user.id, cycleNumber]
      );
      if (paidRes.rows[0]) return res.status(409).json({ success: false, message: 'Already contributed this cycle' });

      // Create pending contribution
      const contribRes = await query(
        `INSERT INTO contributions (group_id, user_id, amount, cycle_number, payment_method)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [groupId, req.user.id, group.contribution_amount, cycleNumber, payment_method]
      );
      const contribId = contribRes.rows[0].id;

      // Process payment
      const payment = await processPayment({
        method: payment_method,
        phone: req.user.phone,
        amount: group.contribution_amount,
        reference: contribId,
        description: `Via contribution - ${group.name}`,
      });

      if (payment.success) {
        await query(
          `UPDATE contributions SET status = 'completed', transaction_id = $1, paid_at = NOW() WHERE id = $2`,
          [payment.transactionId, contribId]
        );
        // Notify group admin
        const adminRes = await query(
          `SELECT user_id FROM members WHERE group_id = $1 AND role = 'admin'`, [groupId]
        );
        if (adminRes.rows[0]) {
          await sendNotificationToUser({
            userId: adminRes.rows[0].user_id,
            title: 'New Contribution',
            message: `${req.user.name} has contributed ${group.contribution_amount} XAF`,
            type: 'contribution', groupId,
          });
        }
        return res.json({ success: true, message: 'Contribution successful', data: { transactionId: payment.transactionId } });
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

module.exports = { contribute, getContributions };
