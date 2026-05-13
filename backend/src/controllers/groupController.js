const { body } = require('express-validator');
const { query } = require('../config/database');
const { validate } = require('../middleware/validate');
const payoutQueueService = require('../services/payoutQueueService');
const { generatePayoutQueue } = payoutQueueService;
const { sendNotificationToUser } = require('../services/notificationService');
const { recalculateTrustScore } = require('../services/trustScoreService');
const { triggerAutopayForGroup } = require('./installmentController');
const crypto = require('crypto');

const generateInviteToken = () => crypto.randomBytes(16).toString('hex');

const createGroup = [
  body('name').trim().notEmpty().withMessage('Group name is required'),
  body('contribution_amount').isFloat({ min: 1 }).withMessage('Valid contribution amount required'),
  body('cycle').isIn(['weekly', 'biweekly', 'monthly']).withMessage('Cycle must be weekly, biweekly, or monthly'),
  body('max_members').optional().isInt({ min: 2, max: 50 }),
  body('deadline_days_before').optional().isInt({ min: 1, max: 7 }),
  body('late_penalty_type').optional().isIn(['fixed', 'percent']),
  body('late_penalty_value').optional().isFloat({ min: 0 }),
  body('visibility').optional().isIn(['public', 'private', 'region']),
  body('visibility_country').optional().trim(),
  body('visibility_city').optional().trim(),
  validate,
  async (req, res, next) => {
    try {
      const { name, description, contribution_amount, cycle, max_members, start_date,
              deadline_days_before, late_penalty_type, late_penalty_value,
              visibility, visibility_country, visibility_city } = req.body;
      const result = await query(
        `INSERT INTO groups (name, description, created_by, contribution_amount, cycle, max_members, start_date,
                             deadline_days_before, late_penalty_type, late_penalty_value,
                             visibility, visibility_country, visibility_city)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
        [name, description, req.user.id, contribution_amount, cycle, max_members || 10, start_date,
         deadline_days_before || null, late_penalty_type || null, late_penalty_value || null,
         visibility || 'public', visibility_country || null, visibility_city || null]
      );
      const group = result.rows[0];
      await query(`INSERT INTO members (group_id, user_id, role, status) VALUES ($1, $2, 'admin', 'approved')`, [group.id, req.user.id]);
      res.status(201).json({ success: true, data: group });
    } catch (error) { next(error); }
  },
];

const getGroups = async (req, res, next) => {
  try {
    // Get requesting user's location for region filtering
    const userRes = await query(
      'SELECT city, country FROM users WHERE id = $1',
      [req.user.id]
    );
    const userCity    = userRes.rows[0]?.city    || null;
    const userCountry = userRes.rows[0]?.country || null;

    // Check which groups the user is a member of
    const memberGroupsRes = await query(
      `SELECT group_id FROM members WHERE user_id = $1 AND status IN ('approved', 'pending', 'pending_reconfirm')`,
      [req.user.id]
    );
    const memberGroupIds = new Set(memberGroupsRes.rows.map(r => r.group_id));

    const result = await query(
      `SELECT g.*, COUNT(m.id) as member_count FROM groups g
       LEFT JOIN members m ON g.id = m.group_id AND m.status = 'approved'
       WHERE g.status != 'cancelled'
       GROUP BY g.id ORDER BY g.created_at DESC`
    );

    // Filter based on visibility
    const filtered = result.rows.filter(g => {
      // Members always see their own groups
      if (memberGroupIds.has(g.id)) return true;

      const vis = g.visibility || 'public';
      if (vis === 'public')  return true;
      if (vis === 'private') return false; // only members can see
      if (vis === 'region') {
        // Must match country (and optionally city)
        const countryMatch = !g.visibility_country || g.visibility_country === userCountry;
        const cityMatch    = !g.visibility_city    || g.visibility_city    === userCity;
        return countryMatch && cityMatch;
      }
      return true;
    });

    res.json({ success: true, data: filtered });
  } catch (error) { next(error); }
};

const getGroup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [groupRes, membersRes] = await Promise.all([
      query(`SELECT g.*, COUNT(m.id) as member_count FROM groups g
             LEFT JOIN members m ON g.id = m.group_id AND m.status IN ('approved','pending','pending_reconfirm','forfeited')
             WHERE g.id = $1 GROUP BY g.id`, [id]),
      query(`SELECT m.*, u.name, u.phone, u.tc_balance, u.trust_score FROM members m
             JOIN users u ON m.user_id = u.id
             WHERE m.group_id = $1 AND m.status != 'rejected'`, [id]),
    ]);
    if (!groupRes.rows[0]) return res.status(404).json({ success: false, message: 'Group not found' });

    // Check if requesting user is a member
    const isMember = membersRes.rows.some(m => m.user_id === req.user.id);

    // Mask personal info for non-members
    const members = membersRes.rows.map(m => {
      if (isMember) return m;
      return {
        ...m,
        name:  '••••••••',
        phone: '••••••••••••',
      };
    });

    res.json({ success: true, data: { ...groupRes.rows[0], members } });
  } catch (error) { next(error); }
};

const joinGroup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const group = await query('SELECT * FROM groups WHERE id = $1', [id]);
    if (!group.rows[0]) return res.status(404).json({ success: false, message: 'Group not found' });
    const status = group.rows[0].status;
    if (status === 'active') return res.status(400).json({ success: false, message: 'This group is active and not accepting new members. Wait for the next re-forming phase.' });
    if (status !== 'forming' && status !== 're-forming') return res.status(400).json({ success: false, message: 'Group is no longer accepting members' });
    const existing = await query('SELECT id FROM members WHERE group_id = $1 AND user_id = $2', [id, req.user.id]);
    if (existing.rows[0]) return res.status(409).json({ success: false, message: 'Already a member' });
    await query(`INSERT INTO members (group_id, user_id, invited_by) VALUES ($1, $2, $3)`, [id, req.user.id, req.body.invited_by || null]);
    res.json({ success: true, message: 'Join request sent' });
  } catch (error) { next(error); }
};

const approveMember = async (req, res, next) => {
  try {
    const { id, userId } = req.params;
    const groupRes = await query('SELECT name FROM groups WHERE id = $1', [id]);
    const groupName = groupRes.rows[0]?.name || 'the group';
    await query(`UPDATE members SET status = 'approved' WHERE group_id = $1 AND user_id = $2`, [id, userId]);
    await sendNotificationToUser({ userId, title: 'Membership Approved', message: `Your request to join "${groupName}" has been approved.`, type: 'group_update', groupId: id });
    res.json({ success: true, message: 'Member approved' });
  } catch (error) { next(error); }
};

const rejectMember = async (req, res, next) => {
  try {
    const { id, userId } = req.params;
    const groupRes = await query('SELECT name FROM groups WHERE id = $1', [id]);
    const groupName = groupRes.rows[0]?.name || 'the group';
    await query(`DELETE FROM members WHERE group_id = $1 AND user_id = $2`, [id, userId]);
    await sendNotificationToUser({ userId, title: 'Membership Declined', message: `Your request to join "${groupName}" has been declined by the admin.`, type: 'group_update', groupId: id });
    res.json({ success: true, message: 'Member declined' });
  } catch (error) { next(error); }
};

const startGroup = async (req, res, next) => {
  try {
    const { id } = req.params;

    const groupRes = await query('SELECT * FROM groups WHERE id = $1', [id]);
    const group = groupRes.rows[0];
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    if (group.status !== 'forming') return res.status(400).json({ success: false, message: 'Group is not in forming phase' });
    if (group.group_type === 'flexible') return res.status(400).json({ success: false, message: 'Use POST /groups/:id/activate for flexible groups' });

    // Count approved members
    const countRes = await query(
      `SELECT COUNT(*) as count FROM members WHERE group_id = $1 AND status = 'approved'`,
      [id]
    );
    const approvedCount = Number(countRes.rows[0].count);

    if (approvedCount < 2) {
      return res.status(400).json({
        success: false,
        message: `At least 2 approved members are required to start the group. Currently ${approvedCount}.`,
      });
    }

    if (approvedCount < Number(group.max_members)) {
      return res.status(400).json({
        success: false,
        message: `Group is not full yet. ${approvedCount} of ${group.max_members} members have joined. All spots must be filled before starting.`,
        approved: approvedCount,
        required: Number(group.max_members),
      });
    }

    await query(`UPDATE groups SET status = 'active', updated_at = NOW() WHERE id = $1`, [id]);
    await generatePayoutQueue(id);

    // Trigger autopay for members who have it enabled
    triggerAutopayForGroup(id).catch(() => {});

    // Notify all members
    const membersRes = await query(`SELECT user_id FROM members WHERE group_id = $1 AND status = 'approved'`, [id]);
    await Promise.all(membersRes.rows.map(m => sendNotificationToUser({
      userId: m.user_id,
      title: 'Group Started!',
      message: `"${group.name}" has started! The payout queue has been generated.`,
      type: 'group_update',
      groupId: id,
    })));

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
  body('visibility').optional().isIn(['public', 'private', 'region']),
  body('visibility_country').optional().trim(),
  body('visibility_city').optional().trim(),
  validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const group = await query('SELECT * FROM groups WHERE id = $1', [id]);
      if (!group.rows[0]) return res.status(404).json({ success: false, message: 'Group not found' });

      const { status, member_count } = group.rows[0];
      const { name, description, max_members, start_date, contribution_amount, cycle,
              visibility, visibility_country, visibility_city } = req.body;

      const isForming   = status === 'forming';
      const isReforming = status === 're-forming';

      // contribution_amount and cycle only editable during forming or re-forming
      if ((contribution_amount !== undefined || cycle !== undefined) && !isForming && !isReforming) {
        return res.status(400).json({ success: false, message: 'Contribution amount and cycle can only be changed while the group is forming or re-forming' });
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
          visibility         = COALESCE($7, visibility),
          visibility_country = COALESCE($8, visibility_country),
          visibility_city    = COALESCE($9, visibility_city),
          updated_at         = NOW()
         WHERE id = $10
         RETURNING *`,
        [name ?? null, description ?? null, max_members ?? null, start_date ?? null,
         contribution_amount ?? null, cycle ?? null,
         visibility ?? null, visibility_country ?? null, visibility_city ?? null, id]
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

// POST /groups/:id/payouts/:payoutId/process — admin marks a payout as disbursed
const processPayout = async (req, res, next) => {
  try {
    const { id: groupId, payoutId } = req.params;

    // Verify the payout belongs to this group
    const payoutCheck = await query('SELECT id FROM payouts WHERE id = $1 AND group_id = $2', [payoutId, groupId]);
    if (!payoutCheck.rows[0]) return res.status(404).json({ success: false, message: 'Payout not found' });

    const payout = await payoutQueueService.processPayout(payoutId);

    // Check if circle is now complete (all payouts done)
    await payoutQueueService.checkAndAutoCompleteCircle(groupId);

    res.json({ success: true, message: `Payout of ${Number(payout.amount).toLocaleString()} XAF processed successfully`, data: payout });
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
    recalculateTrustScore(req.user.id).catch(() => {});
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

    // Trigger autopay for new circle
    triggerAutopayForGroup(id).catch(() => {});

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

module.exports = { createGroup, getGroups, getGroup, joinGroup, approveMember, rejectMember, startGroup, updateGroup, getPayouts, processPayout, getInviteLink, joinByInvite, endCircle, reconfirmMembership, forfeitMembership, startNextCircle };
