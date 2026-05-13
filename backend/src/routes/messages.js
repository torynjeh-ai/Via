const { Router } = require('express');
const { authenticate, requireGroupAdmin } = require('../middleware/auth');
const { query } = require('../config/database');

const router = Router({ mergeParams: true }); // gets :id from parent

router.use(authenticate);

// GET /groups/:id/messages?before=<timestamp>&limit=50
router.get('/', async (req, res, next) => {
  try {
    const groupId = req.params.id;
    const limit   = Math.min(parseInt(req.query.limit) || 50, 100);
    const before  = req.query.before; // ISO timestamp for pagination

    // Verify membership
    const memberRes = await query(
      `SELECT id FROM members WHERE group_id = $1 AND user_id = $2 AND status = 'approved'`,
      [groupId, req.user.id]
    );
    if (!memberRes.rows[0]) return res.status(403).json({ success: false, message: 'Not a group member' });

    const params = [groupId, limit];
    const whereClause = before
      ? `AND m.created_at < $3 ORDER BY m.created_at DESC LIMIT $2`
      : `ORDER BY m.created_at DESC LIMIT $2`;
    if (before) params.push(before);

    const result = await query(
      `SELECT m.id, m.message, m.is_system, m.created_at,
              u.id as user_id, u.name, u.profile_picture_url
       FROM group_messages m
       LEFT JOIN users u ON m.user_id = u.id
       WHERE m.group_id = $1 ${whereClause}`,
      params
    );

    // Return in ascending order for display
    res.json({ success: true, data: result.rows.reverse() });
  } catch (error) { next(error); }
});

// DELETE /groups/:id/messages/:messageId — admin only
router.delete('/:messageId', requireGroupAdmin, async (req, res, next) => {
  try {
    const { id: groupId, messageId } = req.params;
    await query(
      `DELETE FROM group_messages WHERE id = $1 AND group_id = $2`,
      [messageId, groupId]
    );
    res.json({ success: true, message: 'Message deleted' });
  } catch (error) { next(error); }
});

module.exports = router;
