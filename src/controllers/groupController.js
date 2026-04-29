const { body, param } = require('express-validator');
const { query } = require('../config/database');
const { validate } = require('../middleware/validate');
const { generatePayoutQueue } = require('../services/payoutQueueService');
const { sendNotificationToUser } = require('../services/notificationService');

// POST /groups
const createGroup = [
  body('name').trim().notEmpty().withMessage('Group name is required'),
  body('contribution_amount').isFloat({ min: 1 }).withMessage('Valid contribution amount required'),
  body('cycle').isIn(['weekly', 'biweekly', 'monthly']).withMessage('Cycle must be weekly, biweekly, or monthly'),
  body('max_members').optional().isInt({ min: 2, max: 50 }),
  validate,
  async (req, res, next) => {
    try {
      const { name, description, contribution_amount, cycle, max_members, start_date } = req.body;
      const result = await query(
        `INSERT INTO groups (name, description, created_by, contribution_amount, cycle, max_members, start_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [name, description, req.user.id, contribution_amount, cycle, max_members || 10, start_date]
      );
      const group = result.rows[0];
      // Creator becomes admin member
      await query(
        `INSERT INTO members (group_id, user_id, role, status) VALUES ($1, $2, 'admin', 'approved')`,
        [group.id, req.user.id]
      );
      res.status(201).json({ success: true, data: group });
    } catch (error) { next(error); }
  },
];

// GET /groups
const getGroups = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT g.*, COUNT(m.id) as member_count
       FROM groups g
       LEFT JOIN members m ON g.id = m.group_id AND m.status = 'approved'
       WHERE g.status != 'cancelled'
       GROUP BY g.id ORDER BY g.created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) { next(error); }
};

// GET /groups/:id
const getGroup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [groupRes, membersRes] = await Promise.all([
      query(`SELECT g.*, COUNT(m.id) as member_count FROM groups g
             LEFT JOIN members m ON g.id = m.group_id AND m.status = 'approved'
             WHERE g.id = $1 GROUP BY g.id`, [id]),
      query(`SELECT m.*, u.name, u.phone, u.trust_score FROM members m
             JOIN users u ON m.user_id = u.id WHERE m.group_id = $1`, [id]),
    ]);
    if (!groupRes.rows[0]) return res.status(404).json({ success: false, message: 'Group not found' });
    res.json({ success: true, data: { ...groupRes.rows[0], members: membersRes.rows } });
  } catch (error) { next(error); }
};

// POST /groups/:id/join
const joinGroup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const group = await query('SELECT * FROM groups WHERE id = $1', [id]);
    if (!group.rows[0]) return res.status(404).json({ success: false, message: 'Group not found' });
    if (group.rows[0].status !== 'forming') {
      return res.status(400).json({ success: false, message: 'Group is no longer accepting members' });
    }
    const existing = await query('SELECT id FROM members WHERE group_id = $1 AND user_id = $2', [id, req.user.id]);
    if (existing.rows[0]) return res.status(409).json({ success: false, message: 'Already a member' });

    await query(
      `INSERT INTO members (group_id, user_id, invited_by) VALUES ($1, $2, $3)`,
      [id, req.user.id, req.body.invited_by || null]
    );
    res.json({ success: true, message: 'Join request sent' });
  } catch (error) { next(error); }
};

// PATCH /groups/:id/members/:userId/approve
const approveMember = async (req, res, next) => {
  try {
    const { id, userId } = req.params;
    await query(
      `UPDATE members SET status = 'approved' WHERE group_id = $1 AND user_id = $2`,
      [id, userId]
    );
    await sendNotificationToUser({
      userId, title: 'Membership Approved',
      message: 'Your request to join the group has been approved.',
      type: 'group_update', groupId: id,
    });
    res.json({ success: true, message: 'Member approved' });
  } catch (error) { next(error); }
};

// POST /groups/:id/start
const startGroup = async (req, res, next) => {
  try {
    const { id } = req.params;
    await query(`UPDATE groups SET status = 'active' WHERE id = $1`, [id]);
    await generatePayoutQueue(id);
    res.json({ success: true, message: 'Group started and payout queue generated' });
  } catch (error) { next(error); }
};

// GET /groups/:id/payouts
const getPayouts = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT p.*, u.name, u.phone FROM payouts p
       JOIN users u ON p.user_id = u.id
       WHERE p.group_id = $1 ORDER BY p.position`,
      [req.params.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) { next(error); }
};

module.exports = { createGroup, getGroups, getGroup, joinGroup, approveMember, startGroup, getPayouts };
