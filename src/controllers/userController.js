const { body } = require('express-validator');
const { query } = require('../config/database');
const { validate } = require('../middleware/validate');

// GET /users/me
const getMe = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, name, phone, role, trust_score, is_verified, created_at FROM users WHERE id = $1`,
      [req.user.id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) { next(error); }
};

// PATCH /users/me
const updateMe = [
  body('name').optional().trim().notEmpty(),
  body('fcm_token').optional().trim(),
  validate,
  async (req, res, next) => {
    try {
      const { name, fcm_token } = req.body;
      const result = await query(
        `UPDATE users SET
          name = COALESCE($1, name),
          fcm_token = COALESCE($2, fcm_token),
          updated_at = NOW()
         WHERE id = $3 RETURNING id, name, phone, role, trust_score`,
        [name, fcm_token, req.user.id]
      );
      res.json({ success: true, data: result.rows[0] });
    } catch (error) { next(error); }
  },
];

// GET /users/me/groups
const getMyGroups = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT g.*, m.role as my_role, m.status as my_status
       FROM groups g JOIN members m ON g.id = m.group_id
       WHERE m.user_id = $1 ORDER BY g.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) { next(error); }
};

// GET /users/me/notifications
const getNotifications = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) { next(error); }
};

// PATCH /users/me/notifications/:id/read
const markRead = async (req, res, next) => {
  try {
    await query(
      `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (error) { next(error); }
};

module.exports = { getMe, updateMe, getMyGroups, getNotifications, markRead };
