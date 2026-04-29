const { body } = require('express-validator');
const { query } = require('../config/database');
const { validate } = require('../middleware/validate');
const { generatePayoutQueue } = require('../services/payoutQueueService');
const { sendNotificationToUser } = require('../services/notificationService');
const crypto = require('crypto');

const generateInviteToken = () => crypto.randomBytes(16).toString('hex');

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
      await query(`INSERT INTO members (group_id, user_id, role, status) VALUES ($1, $2, 'admin', 'approved')`, [group.id, req.user.id]);
      res.status(201).json({ success: true, data: group });
    } catch (error) { next(error); }
  },
];

const getGroups = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT g.*, COUNT(m.id) as member_count FROM groups g
       LEFT JOIN members m ON g.id = m.group_id AND m.status = 'approved'
       WHERE g.status != 'cancelled' GROUP BY g.id ORDER BY g.created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) { next(error); }
};

const getGroup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [groupRes, membersRes] = await Promise.all([
      query(`SELECT g.*, COUNT(m.id) as member_count FROM groups g
             LEFT JOIN members m ON g.id = m.group_id AND m.status = 'approved'
             WHERE g.id = $1 GROUP BY g.id`, [id]),
      query(`SELECT m.*, u.name, u.phone, u.tc_balance FROM members m
             JOIN users u ON m.user_id = u.id WHERE m.group_id = $1`, [id]),
    ]);
    if (!groupRes.rows[0]) return res.status(404).json({ success: false, message: 'Group not found' });
    res.json({ success: true, data: { ...groupRes.rows[0], members: membersRes.rows } });
  } catch (error) { next(error); }
};

const joinGroup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const group = await query('SELECT * FROM groups WHERE id = $1', [id]);
    if (!group.rows[0]) return res.status(404).json({ success: false, message: 'Group not found' });
    if (group.rows[0].status !== 'forming') return res.status(400).json({ success: false, message: 'Group is no longer accepting members' });
    const existing = await query('SELECT id FROM members WHERE group_id = $1 AND user_id = $2', [id, req.user.id]);
    if (existing.rows[0]) return res.status(409).json({ success: false, message: 'Already a member' });
    await query(`INSERT INTO members (group_id, user_id, invited_by) VALUES ($1, $2, $3)`, [id, req.user.id, req.body.invited_by || null]);
    res.json({ success: true, message: 'Join request sent' });
  } catch (error) { next(error); }
};

const approveMember = async (req, res, next) => {
  try {
    const { id, userId } = req.params;
    await query(`UPDATE members SET status = 'approved' WHERE group_id = $1 AND user_id = $2`, [id, userId]);
    await sendNotificationToUser({ userId, title: 'Membership Approved', message: 'Your request to join the group has been approved.', type: 'group_update', groupId: id });
    res.json({ success: true, message: 'Member approved' });
  } catch (error) { next(error); }
};

const startGroup = async (req, res, next) => {
  try {
    const { id } = req.params;
    await query(`UPDATE groups SET status = 'active' WHERE id = $1`, [id]);
    await generatePayoutQueue(id);
    res.json({ success: true, message: 'Group started and payout queue generated' });
  } catch (error) { next(error); }
};

// PATCH /groups/:id — admin only, editable fields depend on group status
const updateGroup = [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('description').optional().trim(),
  body('max_members').optional().isInt({ min: 2, max: 50 }).withMessage('Max members must be between 2 and 50'),
  body('start_date').optional().isISO8601().withMessage('Invalid date format'),
  body('contribution_amount').optional().isFloat({ min: 1 }).withMessage('Valid contribution amount required'),
  body('cycle').optional().isIn(['weekly', 'biweekly', 'monthly']).withMessage('Cycle must be weekly, biweekly, or monthly'),
  validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const group = await query('SELECT * FROM groups WHERE id = $1', [id]);
      if (!group.rows[0]) return res.status(404).json({ success: false, message: 'Group not found' });

      const { status, member_count } = group.rows[0];
      const { name, description, max_members, start_date, contribution_amount, cycle } = req.body;

      const isForming   = status === 'forming';
      const isReforming = status === 're-forming';

      // contribution_amount and cycle only editable during re-forming
      if ((contribution_amount !== undefined || cycle !== undefined) && !isReforming) {
        return res.status(400).json({ success: false, message: 'Contribution amount and cycle can only be changed during re-forming' });
      }

      // max_members and start_date only editable during forming or re-forming
      if (max_members !== undefined && !isForming && !isReforming) {
        return res.status(400).json({ success: false, message: 'Max members can only be changed while the group is forming or re-forming' });
      }
      if (max_members !== undefined && max_members < Number(member_count)) {
        return res.status(400).json({ success: false, message: `Max members cannot be less than current member count (${member_count})` });
      }
      if (start_date !== undefined && !isForming && !isReforming) {
        return res.status(400).json({ success: false, message: 'Start date can only be changed while the group is forming or re-forming' });
      }

      const result = await query(
        `UPDATE groups SET
          name               = COALESCE($1, name),
          description        = COALESCE($2, description),
          max_members        = COALESCE($3, max_members),
          start_date         = COALESCE($4, start_date),
          contribution_amount = COALESCE($5, contribution_amount),
          cycle              = COALESCE($6, cycle),
          updated_at         = NOW()
         WHERE id = $7
         RETURNING *`,
        [name ?? null, description ?? null, max_members ?? null, start_date ?? null, contribution_amount ?? null, cycle ?? null, id]
      );

      res.json({ success: true, message: 'Group updated', data: result.rows[0] });
    } catch (error) { next(error); }
  },
];

const getPayouts = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT p.*, u.name, u.phone FROM payouts p JOIN users u ON p.user_id = u.id WHERE p.group_id = $1 ORDER BY p.position`,
      [req.params.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) { next(error); }
};

// GET /groups/:id/invite — get or generate invite token (any approved member)
const getInviteLink = async (req, res, next) => {
  try {
    const { id } = req.params;
    // Verify caller is an approved member
    const member = await query(
      `SELECT id FROM members WHERE group_id = $1 AND user_id = $2 AND status = 'approved'`,
      [id, req.user.id]
    );
    if (!member.rows[0]) return res.status(403).json({ success: false, message: 'Only group members can get the invite link' });

    // Get or generate token
    let group = await query('SELECT invite_token FROM groups WHERE id = $1', [id]);
    let token = group.rows[0]?.invite_token;
    if (!token) {
      token = generateInviteToken();
      await query('UPDATE groups SET invite_token = $1 WHERE id = $2', [token, id]);
    }
    res.json({ success: true, data: { token, invite_url: `${process.env.APP_URL || 'http://localhost:5174'}/join/${token}` } });
  } catch (error) { next(error); }
};

// POST /groups/join-by-invite/:token — join via invite link
const joinByInvite = async (req, res, next) => {
  try {
    const { token } = req.params;
    const groupRes = await query('SELECT * FROM groups WHERE invite_token = $1', [token]);
    const group = groupRes.rows[0];
    if (!group) return res.status(404).json({ success: false, message: 'Invalid or expired invite link' });
    if (group.status !== 'forming') return res.status(400).json({ success: false, message: 'This group is no longer accepting members' });

    const existing = await query('SELECT id FROM members WHERE group_id = $1 AND user_id = $2', [group.id, req.user.id]);
    if (existing.rows[0]) return res.status(409).json({ success: false, message: 'You are already a member of this group' });

    await query(`INSERT INTO members (group_id, user_id) VALUES ($1, $2)`, [group.id, req.user.id]);

    // Notify admins
    const admins = await query(`SELECT user_id FROM members WHERE group_id = $1 AND role = 'admin' AND status = 'approved'`, [group.id]);
    await Promise.all(admins.rows.map(a => sendNotificationToUser({
      userId: a.user_id,
      title: 'New Join Request',
      message: `${req.user.name} wants to join ${group.name} via invite link`,
      type: 'group_update',
      groupId: group.id,
    })));

    res.json({ success: true, message: 'Join request sent. Waiting for admin approval.', data: { group_id: group.id, group_name: group.name } });
  } catch (error) { next(error); }
};

// POST /groups/:id/end-circle — admin only, group must be active
// Marks circle complete, returns group to re-forming, notifies all members to re-confirm
const endCircle = async (req, res, next) => {
  try {
    const { id } = req.params;
    const groupRes = await query('SELECT * FROM groups WHERE id = $1', [id]);
    const group = groupRes.rows[0];
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    if (group.status !== 'active') return res.status(400).json({ success: false, message: 'Group must be active to end a circle' });

    const { keep_rules } = req.body; // true = keep existing rules, false = admin will edit

    // Return group to re-forming, increment circle number
    await query(
      `UPDATE groups SET status = 're-forming', circle_number = circle_number + 1, re_forming_since = NOW(), updated_at = NOW() WHERE id = $1`,
      [id]
    );

    // Set all approved members to pending_reconfirm
    await query(
      `UPDATE members SET status = 'pending_reconfirm' WHERE group_id = $1 AND status = 'approved'`,
      [id]
    );

    // Notify all members to re-confirm
    const membersRes = await query(
      `SELECT user_id FROM members WHERE group_id = $1 AND status = 'pending_reconfirm'`,
      [id]
    );
    await Promise.all(membersRes.rows.map(m => sendNotificationToUser({
      userId: m.user_id,
      title: 'Circle Complete — Re-confirm to Continue',
      message: `Circle ${group.circle_number} of "${group.name}" is complete! Please re-confirm your membership to join the next circle, or forfeit to leave the group.`,
      type: 'group_update',
      groupId: id,
    })));

    res.json({
      success: true,
      message: `Circle ${group.circle_number} ended. Group is now re-forming. Members have been notified to re-confirm.`,
      data: { circle_completed: group.circle_number, new_circle: group.circle_number + 1, keep_rules: keep_rules !== false },
    });
  } catch (error) { next(error); }
};

// POST /groups/:id/reconfirm — member re-confirms for next circle
const reconfirmMembership = async (req, res, next) => {
  try {
    const { id } = req.params;
    const groupRes = await query('SELECT * FROM groups WHERE id = $1', [id]);
    if (!groupRes.rows[0]) return res.status(404).json({ success: false, message: 'Group not found' });
    if (groupRes.rows[0].status !== 're-forming') return res.status(400).json({ success: false, message: 'Group is not in re-forming phase' });

    const memberRes = await query(
      `SELECT * FROM members WHERE group_id = $1 AND user_id = $2`,
      [id, req.user.id]
    );
    const member = memberRes.rows[0];
    if (!member) return res.status(403).json({ success: false, message: 'You are not a member of this group' });
    if (member.status !== 'pending_reconfirm') return res.status(400).json({ success: false, message: 'You have already responded' });

    await query(
      `UPDATE members SET status = 'approved', updated_at = NOW() WHERE group_id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    // Notify admins
    const admins = await query(`SELECT user_id FROM members WHERE group_id = $1 AND role = 'admin' AND status = 'approved'`, [id]);
    await Promise.all(admins.rows.map(a => sendNotificationToUser({
      userId: a.user_id,
      title: 'Member Re-confirmed',
      message: `${req.user.name} has re-confirmed their membership for the next circle of "${groupRes.rows[0].name}".`,
      type: 'group_update',
      groupId: id,
    })));

    res.json({ success: true, message: 'You have re-confirmed your membership for the next circle.' });
  } catch (error) { next(error); }
};

// POST /groups/:id/forfeit — member forfeits (permanently leaves) during re-forming
const forfeitMembership = async (req, res, next) => {
  try {
    const { id } = req.params;
    const groupRes = await query('SELECT * FROM groups WHERE id = $1', [id]);
    if (!groupRes.rows[0]) return res.status(404).json({ success: false, message: 'Group not found' });
    if (groupRes.rows[0].status !== 're-forming') return res.status(400).json({ success: false, message: 'You can only forfeit during the re-forming phase' });

    const memberRes = await query(
      `SELECT * FROM members WHERE group_id = $1 AND user_id = $2`,
      [id, req.user.id]
    );
    const member = memberRes.rows[0];
    if (!member) return res.status(403).json({ success: false, message: 'You are not a member of this group' });
    if (!['pending_reconfirm', 'approved'].includes(member.status)) {
      return res.status(400).json({ success: false, message: 'You cannot forfeit at this time' });
    }

    // Permanently mark as forfeited
    await query(
      `UPDATE members SET status = 'forfeited', updated_at = NOW() WHERE group_id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    // Notify admins
    const admins = await query(`SELECT user_id FROM members WHERE group_id = $1 AND role = 'admin' AND status = 'approved'`, [id]);
    await Promise.all(admins.rows.map(a => sendNotificationToUser({
      userId: a.user_id,
      title: 'Member Forfeited',
      message: `${req.user.name} has forfeited their membership in "${groupRes.rows[0].name}" and will not continue to the next circle.`,
      type: 'group_update',
      groupId: id,
    })));

    res.json({ success: true, message: 'You have forfeited your membership. You will not be part of the next circle.' });
  } catch (error) { next(error); }
};

// POST /groups/:id/start-next-circle — admin starts next circle after re-forming
const startNextCircle = async (req, res, next) => {
  try {
    const { id } = req.params;
    const groupRes = await query('SELECT * FROM groups WHERE id = $1', [id]);
    const group = groupRes.rows[0];
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    if (group.status !== 're-forming') return res.status(400).json({ success: false, message: 'Group must be in re-forming phase to start next circle' });

    // Check there are still pending_reconfirm members — warn admin
    const pendingRes = await query(
      `SELECT COUNT(*) as count FROM members WHERE group_id = $1 AND status = 'pending_reconfirm'`,
      [id]
    );
    const pendingCount = Number(pendingRes.rows[0].count);
    if (pendingCount > 0 && !req.body.force) {
      return res.status(400).json({
        success: false,
        message: `${pendingCount} member(s) have not yet re-confirmed. Use force: true to start anyway (they will be forfeited).`,
        pending_count: pendingCount,
      });
    }

    // Auto-forfeit any remaining pending_reconfirm members if force=true
    if (pendingCount > 0) {
      await query(
        `UPDATE members SET status = 'forfeited', updated_at = NOW() WHERE group_id = $1 AND status = 'pending_reconfirm'`,
        [id]
      );
    }

    // Check minimum members (at least 2)
    const confirmedRes = await query(
      `SELECT COUNT(*) as count FROM members WHERE group_id = $1 AND status = 'approved'`,
      [id]
    );
    const confirmedCount = Number(confirmedRes.rows[0].count);
    if (confirmedCount < 2) {
      return res.status(400).json({ success: false, message: 'At least 2 confirmed members are required to start a new circle' });
    }

    // Activate group and generate new payout queue
    await query(`UPDATE groups SET status = 'active', re_forming_since = NULL, updated_at = NOW() WHERE id = $1`, [id]);
    await generatePayoutQueue(id);

    // Notify all confirmed members
    const membersRes = await query(`SELECT user_id FROM members WHERE group_id = $1 AND status = 'approved'`, [id]);
    await Promise.all(membersRes.rows.map(m => sendNotificationToUser({
      userId: m.user_id,
      title: `Circle ${group.circle_number} Started!`,
      message: `The next circle of "${group.name}" has begun. A new payout queue has been generated.`,
      type: 'group_update',
      groupId: id,
    })));

    res.json({
      success: true,
      message: `Circle ${group.circle_number} started with ${confirmedCount} members.`,
      data: { circle_number: group.circle_number, member_count: confirmedCount },
    });
  } catch (error) { next(error); }
};

module.exports = { createGroup, getGroups, getGroup, joinGroup, approveMember, startGroup, updateGroup, getPayouts, getInviteLink, joinByInvite, endCircle, reconfirmMembership, forfeitMembership, startNextCircle };
