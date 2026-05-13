/**
 * Flexible Contribution Group Controller
 *
 * Handles all operations specific to groups of type 'flexible':
 *   - Create / update / activate / close / delete
 *   - Contributions (free-form amount, no fixed cycle)
 *   - Pool summary (with optional goal progress)
 *   - Disbursements (manual records only — no automated payments)
 */

const { body } = require('express-validator');
const { query, pool } = require('../config/database');
const { validate } = require('../middleware/validate');
const { processPayment } = require('../services/paymentService');
const walletService = require('../services/walletService');
const { sendNotificationToUser } = require('../services/notificationService');
const logger = require('../utils/logger');

const TC_TO_XAF = 10000;

// ── Helpers ────────────────────────────────────────────────────────────────

const assertFlexible = (group, res) => {
  if (!group) { res.status(404).json({ success: false, message: 'Group not found' }); return false; }
  if (group.group_type !== 'flexible') {
    res.status(400).json({ success: false, message: 'This operation is only available for flexible groups' });
    return false;
  }
  return true;
};

const getApprovedMembers = async (groupId) => {
  const r = await query(
    `SELECT user_id FROM members WHERE group_id = $1 AND status = 'approved'`,
    [groupId]
  );
  return r.rows;
};

const notifyAllMembers = async (members, { title, message, groupId }) => {
  await Promise.all(members.map(m =>
    sendNotificationToUser({ userId: m.user_id, title, message, type: 'group_update', groupId })
      .catch(() => {})
  ));
};

// ── CREATE ─────────────────────────────────────────────────────────────────

const createFlexibleGroup = [
  body('name').trim().notEmpty().withMessage('Group name is required'),
  body('goal_amount').optional({ nullable: true }).isFloat({ min: 0.01 }).withMessage('Goal amount must be a positive number'),
  body('fundraiser_deadline').optional({ nullable: true }).isISO8601().withMessage('Deadline must be a valid date'),
  body('max_members').optional({ nullable: true }).isInt({ min: 2, max: 500 }),
  body('visibility').optional().isIn(['public', 'private', 'region']),
  body('visibility_country').optional().trim(),
  body('visibility_city').optional().trim(),
  validate,
  async (req, res, next) => {
    try {
      const { name, description, goal_amount, fundraiser_deadline, max_members, visibility, visibility_country, visibility_city } = req.body;

      const result = await query(
        `INSERT INTO groups
           (name, description, created_by, group_type, goal_amount, fundraiser_deadline, max_members,
            visibility, visibility_country, visibility_city)
         VALUES ($1, $2, $3, 'flexible', $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          name,
          description || null,
          req.user.id,
          goal_amount || null,
          fundraiser_deadline || null,
          max_members || null,
          visibility || 'public',
          visibility_country || null,
          visibility_city || null,
        ]
      );
      const group = result.rows[0];

      // Auto-add creator as approved admin
      await query(
        `INSERT INTO members (group_id, user_id, role, status) VALUES ($1, $2, 'admin', 'approved')`,
        [group.id, req.user.id]
      );

      res.status(201).json({ success: true, message: 'Fundraiser created!', data: group });
    } catch (error) { next(error); }
  },
];

// ── UPDATE SETTINGS ────────────────────────────────────────────────────────

const updateFlexibleGroupSettings = [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('description').optional().trim(),
  body('goal_amount').optional({ nullable: true }).custom(v => {
    if (v === null || v === undefined) return true;
    if (typeof v === 'number' && v > 0) return true;
    throw new Error('Goal amount must be a positive number or null');
  }),
  body('fundraiser_deadline').optional({ nullable: true }).isISO8601().withMessage('Deadline must be a valid date'),
  body('max_members').optional({ nullable: true }).isInt({ min: 2, max: 500 }),
  body('visibility').optional().isIn(['public', 'private', 'region']),
  body('visibility_country').optional().trim(),
  body('visibility_city').optional().trim(),
  validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const groupRes = await query('SELECT * FROM groups WHERE id = $1', [id]);
      const group = groupRes.rows[0];
      if (!assertFlexible(group, res)) return;

      const { name, description, goal_amount, fundraiser_deadline, max_members, visibility, visibility_country, visibility_city } = req.body;

      // max_members can only shrink if it stays >= current approved count
      if (max_members !== undefined && max_members !== null) {
        const countRes = await query(
          `SELECT COUNT(*) as c FROM members WHERE group_id = $1 AND status = 'approved'`,
          [id]
        );
        if (max_members < Number(countRes.rows[0].c)) {
          return res.status(400).json({
            success: false,
            message: `Max members cannot be less than current approved member count (${countRes.rows[0].c})`,
          });
        }
      }

      const result = await query(
        `UPDATE groups SET
           name                = COALESCE($1, name),
           description         = COALESCE($2, description),
           goal_amount         = CASE WHEN $3::boolean THEN $4::decimal ELSE goal_amount END,
           fundraiser_deadline = CASE WHEN $5::boolean THEN $6::date   ELSE fundraiser_deadline END,
           max_members         = COALESCE($7, max_members),
           visibility          = COALESCE($8, visibility),
           visibility_country  = COALESCE($9, visibility_country),
           visibility_city     = COALESCE($10, visibility_city),
           updated_at          = NOW()
         WHERE id = $11
         RETURNING *`,
        [
          name ?? null,
          description ?? null,
          'goal_amount' in req.body,
          goal_amount ?? null,
          'fundraiser_deadline' in req.body,
          fundraiser_deadline ?? null,
          max_members ?? null,
          visibility ?? null,
          visibility_country ?? null,
          visibility_city ?? null,
          id,
        ]
      );

      res.json({ success: true, message: 'Group settings updated', data: result.rows[0] });
    } catch (error) { next(error); }
  },
];

// ── ACTIVATE ───────────────────────────────────────────────────────────────

const activateFlexibleGroup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const groupRes = await query('SELECT * FROM groups WHERE id = $1', [id]);
    const group = groupRes.rows[0];
    if (!assertFlexible(group, res)) return;
    if (group.status !== 'forming') {
      return res.status(400).json({ success: false, message: 'Group is not in forming phase' });
    }

    // Require at least 1 approved non-admin member
    const memberCountRes = await query(
      `SELECT COUNT(*) as c FROM members WHERE group_id = $1 AND status = 'approved' AND role != 'admin'`,
      [id]
    );
    if (Number(memberCountRes.rows[0].c) < 1) {
      return res.status(400).json({
        success: false,
        message: 'At least 1 approved member (other than the admin) is required to activate the group',
      });
    }

    await query(`UPDATE groups SET status = 'active', updated_at = NOW() WHERE id = $1`, [id]);

    const members = await getApprovedMembers(id);
    await notifyAllMembers(members, {
      title: `"${group.name}" is now active!`,
      message: `The group "${group.name}" has been activated. You can now start contributing to the pool.`,
      groupId: id,
    });

    res.json({ success: true, message: 'Group activated successfully' });
  } catch (error) { next(error); }
};

// ── CLOSE ──────────────────────────────────────────────────────────────────

const closeFlexibleGroup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const groupRes = await query('SELECT * FROM groups WHERE id = $1', [id]);
    const group = groupRes.rows[0];
    if (!assertFlexible(group, res)) return;
    if (group.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Group is not active' });
    }

    await query(`UPDATE groups SET status = 'completed', updated_at = NOW() WHERE id = $1`, [id]);

    const remaining = Number(group.pool_balance);
    const members = await getApprovedMembers(id);
    await notifyAllMembers(members, {
      title: `"${group.name}" has been closed`,
      message: remaining > 0
        ? `The group "${group.name}" has been closed by the admin. Remaining pool balance: ${remaining.toLocaleString()} XAF.`
        : `The group "${group.name}" has been closed by the admin.`,
      groupId: id,
    });

    res.json({ success: true, message: 'Group closed', data: { remaining_balance: remaining } });
  } catch (error) { next(error); }
};

// ── DELETE ─────────────────────────────────────────────────────────────────

const deleteFlexibleGroup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { confirm } = req.body;

    if (!confirm) {
      return res.status(400).json({
        success: false,
        message: 'Deletion requires confirm: true in the request body',
      });
    }

    const groupRes = await query('SELECT * FROM groups WHERE id = $1', [id]);
    const group = groupRes.rows[0];
    if (!assertFlexible(group, res)) return;

    // Case 1: not yet activated — always deletable
    if (group.status === 'forming') {
      const members = await getApprovedMembers(id);
      await notifyAllMembers(members, {
        title: `"${group.name}" has been deleted`,
        message: `The fundraiser "${group.name}" has been permanently deleted by the admin.`,
        groupId: id,
      });
      await query(`DELETE FROM groups WHERE id = $1`, [id]);
      return res.json({ success: true, message: 'Group permanently deleted' });
    }

    // Case 2: contributions have started — require at least one disbursement
    const contribRes = await query(
      `SELECT COUNT(*) as c FROM flexible_contributions WHERE group_id = $1 AND status = 'completed'`,
      [id]
    );
    const hasContributions = Number(contribRes.rows[0].c) > 0;

    if (hasContributions) {
      const disbRes = await query(
        `SELECT COUNT(*) as c FROM flexible_disbursements WHERE group_id = $1`,
        [id]
      );
      if (Number(disbRes.rows[0].c) < 1) {
        return res.status(400).json({
          success: false,
          message: 'Contributions have been made to this group. You must record at least one disbursement before deleting.',
        });
      }
    }

    // Notify all members before deletion
    const members = await getApprovedMembers(id);
    await notifyAllMembers(members, {
      title: `"${group.name}" has been deleted`,
      message: `The fundraiser "${group.name}" has been permanently deleted by the admin.`,
      groupId: id,
    });

    await query(`DELETE FROM groups WHERE id = $1`, [id]);
    res.json({ success: true, message: 'Group permanently deleted' });
  } catch (error) { next(error); }
};

// ── CONTRIBUTE ─────────────────────────────────────────────────────────────

const contributeFlexible = [
  body('amount').isFloat({ min: 0.01 }).withMessage('Contribution amount must be greater than zero'),
  body('payment_method').isIn(['tc_wallet', 'mtn_momo', 'orange_money']).withMessage('Invalid payment method'),
  body('note').optional().trim(),
  validate,
  async (req, res, next) => {
    try {
      const { id: groupId } = req.params;
      const { amount, payment_method, note } = req.body;

      const groupRes = await query('SELECT * FROM groups WHERE id = $1', [groupId]);
      const group = groupRes.rows[0];
      if (!assertFlexible(group, res)) return;
      if (group.status !== 'active') {
        return res.status(400).json({ success: false, message: 'Group is not active' });
      }

      // Verify caller is approved member
      const memberRes = await query(
        `SELECT id FROM members WHERE group_id = $1 AND user_id = $2 AND status = 'approved'`,
        [groupId, req.user.id]
      );
      if (!memberRes.rows[0]) {
        return res.status(403).json({ success: false, message: 'Not a group member' });
      }

      // Insert pending contribution
      const contribRes = await query(
        `INSERT INTO flexible_contributions (group_id, user_id, amount, payment_method, note, status)
         VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING id`,
        [groupId, req.user.id, amount, payment_method, note || null]
      );
      const contribId = contribRes.rows[0].id;

      // Process payment
      let transactionId = null;
      if (payment_method === 'tc_wallet') {
        const tcAmount = amount / TC_TO_XAF;
        const walletResult = await walletService.payContribution({
          userId: req.user.id,
          groupId,
          cycleNumber: 0,
          tcAmount,
        });
        if (!walletResult.success) {
          await query(`UPDATE flexible_contributions SET status = 'failed' WHERE id = $1`, [contribId]);
          return res.status(400).json({ success: false, message: walletResult.message });
        }
      } else {
        const payment = await processPayment({
          method: payment_method,
          phone: req.user.phone,
          amount,
          reference: contribId,
          description: `Contribution to "${group.name}"`,
        });
        if (!payment.success) {
          await query(`UPDATE flexible_contributions SET status = 'failed' WHERE id = $1`, [contribId]);
          return res.status(400).json({ success: false, message: payment.message });
        }
        transactionId = payment.transactionId;
      }

      // Atomically mark completed + update pool balance
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `UPDATE flexible_contributions SET status = 'completed', paid_at = NOW(), transaction_id = $1 WHERE id = $2`,
          [transactionId, contribId]
        );
        await client.query(
          `UPDATE groups SET pool_balance = pool_balance + $1, updated_at = NOW() WHERE id = $2`,
          [amount, groupId]
        );
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      // Notify admin
      const adminRes = await query(
        `SELECT user_id FROM members WHERE group_id = $1 AND role = 'admin' AND status = 'approved' LIMIT 1`,
        [groupId]
      );
      if (adminRes.rows[0]) {
        await sendNotificationToUser({
          userId: adminRes.rows[0].user_id,
          title: 'New Contribution Received',
          message: `${req.user.name} contributed ${Number(amount).toLocaleString()} XAF to "${group.name}".`,
          type: 'group_update',
          groupId,
        }).catch(() => {});
      }

      // Fetch updated pool balance
      const updatedGroup = await query('SELECT pool_balance, goal_amount FROM groups WHERE id = $1', [groupId]);
      const newBalance = Number(updatedGroup.rows[0].pool_balance);
      const goalAmount = updatedGroup.rows[0].goal_amount ? Number(updatedGroup.rows[0].goal_amount) : null;

      res.json({
        success: true,
        message: `Contribution of ${Number(amount).toLocaleString()} XAF recorded successfully.`,
        data: {
          contribution_id: contribId,
          amount_paid: Number(amount),
          pool_balance: newBalance,
          goal_amount: goalAmount,
          goal_percent: goalAmount ? Math.min(Math.floor((newBalance / goalAmount) * 100), 100) : null,
        },
      });
    } catch (error) { next(error); }
  },
];

// ── POOL SUMMARY ───────────────────────────────────────────────────────────

const getFlexiblePoolSummary = async (req, res, next) => {
  try {
    const { id: groupId } = req.params;
    const groupRes = await query('SELECT * FROM groups WHERE id = $1', [groupId]);
    const group = groupRes.rows[0];
    if (!assertFlexible(group, res)) return;

    // Verify caller is approved member or admin
    const memberRes = await query(
      `SELECT role FROM members WHERE group_id = $1 AND user_id = $2 AND status = 'approved'`,
      [groupId, req.user.id]
    );
    if (!memberRes.rows[0]) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const isAdmin = memberRes.rows[0].role === 'admin';

    const poolBalance = Number(group.pool_balance);
    const goalAmount  = group.goal_amount ? Number(group.goal_amount) : null;
    const goalPercent = goalAmount ? Math.min(Math.floor((poolBalance / goalAmount) * 100), 100) : null;

    // Contributor count
    const countRes = await query(
      `SELECT COUNT(DISTINCT user_id) as c FROM flexible_contributions WHERE group_id = $1 AND status = 'completed'`,
      [groupId]
    );
    const contributorCount = Number(countRes.rows[0].c);

    const summary = {
      pool_balance:      poolBalance,
      goal_amount:       goalAmount,
      goal_percent:      goalPercent,
      contributor_count: contributorCount,
    };

    // Admin gets per-member breakdown
    if (isAdmin) {
      const breakdownRes = await query(
        `SELECT fc.user_id, u.name,
                SUM(fc.amount) as total_contributed,
                COUNT(*) as contribution_count
         FROM flexible_contributions fc
         JOIN users u ON fc.user_id = u.id
         WHERE fc.group_id = $1 AND fc.status = 'completed'
         GROUP BY fc.user_id, u.name
         ORDER BY total_contributed DESC`,
        [groupId]
      );
      summary.breakdown = breakdownRes.rows.map(r => ({
        user_id:            r.user_id,
        name:               r.name,
        total_contributed:  Number(r.total_contributed),
        contribution_count: Number(r.contribution_count),
      }));
    }

    res.json({ success: true, data: summary });
  } catch (error) { next(error); }
};

// ── CONTRIBUTION HISTORY ───────────────────────────────────────────────────

const getFlexibleContributions = async (req, res, next) => {
  try {
    const { id: groupId } = req.params;
    const groupRes = await query('SELECT group_type FROM groups WHERE id = $1', [groupId]);
    const group = groupRes.rows[0];
    if (!assertFlexible(group, res)) return;

    const memberRes = await query(
      `SELECT role FROM members WHERE group_id = $1 AND user_id = $2 AND status = 'approved'`,
      [groupId, req.user.id]
    );
    if (!memberRes.rows[0]) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const isAdmin = memberRes.rows[0].role === 'admin';

    if (isAdmin) {
      const r = await query(
        `SELECT fc.id, fc.user_id, u.name, fc.amount, fc.payment_method, fc.note, fc.status, fc.paid_at, fc.created_at
         FROM flexible_contributions fc
         JOIN users u ON fc.user_id = u.id
         WHERE fc.group_id = $1
         ORDER BY fc.created_at DESC`,
        [groupId]
      );
      return res.json({ success: true, data: r.rows });
    }

    // Member view — omit name and amount
    const r = await query(
      `SELECT id, payment_method, note, status, paid_at, created_at
       FROM flexible_contributions
       WHERE group_id = $1
       ORDER BY created_at DESC`,
      [groupId]
    );
    res.json({ success: true, data: r.rows });
  } catch (error) { next(error); }
};

// ── CREATE DISBURSEMENT ────────────────────────────────────────────────────

const createDisbursement = [
  body('amount').isFloat({ min: 0.01 }).withMessage('Disbursement amount must be greater than zero'),
  body('disbursement_method').isIn(['tc_wallet', 'mtn_momo', 'orange_money', 'bank_transfer', 'manual'])
    .withMessage('Invalid disbursement method'),
  body('recipient_id').optional({ nullable: true }).isUUID(),
  body('recipient_description').optional().trim(),
  body('note').optional().trim(),
  validate,
  async (req, res, next) => {
    try {
      const { id: groupId } = req.params;
      const { amount, disbursement_method, recipient_id, recipient_description, note } = req.body;

      const groupRes = await query('SELECT * FROM groups WHERE id = $1', [groupId]);
      const group = groupRes.rows[0];
      if (!assertFlexible(group, res)) return;
      if (group.status !== 'active' && group.status !== 'completed') {
        return res.status(400).json({ success: false, message: 'Group must be active or closed to record a disbursement' });
      }

      const poolBalance = Number(group.pool_balance);
      if (amount > poolBalance) {
        return res.status(400).json({
          success: false,
          message: `Insufficient pool balance. Current balance: ${poolBalance.toLocaleString()} XAF`,
          current_balance: poolBalance,
        });
      }

      // Atomically insert disbursement + decrement pool balance
      const client = await pool.connect();
      let disbId;
      try {
        await client.query('BEGIN');
        const disbRes = await client.query(
          `INSERT INTO flexible_disbursements
             (group_id, admin_id, amount, recipient_id, recipient_description, disbursement_method, note, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed')
           RETURNING id`,
          [groupId, req.user.id, amount, recipient_id || null, recipient_description || null, disbursement_method, note || null]
        );
        disbId = disbRes.rows[0].id;
        await client.query(
          `UPDATE groups SET pool_balance = pool_balance - $1, updated_at = NOW() WHERE id = $2`,
          [amount, groupId]
        );
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      // Notify all approved members
      const members = await getApprovedMembers(groupId);
      const recipientLabel = recipient_description || (recipient_id ? `a group member` : 'an external recipient');
      await notifyAllMembers(members, {
        title: `Disbursement recorded in "${group.name}"`,
        message: `The admin recorded a disbursement of ${Number(amount).toLocaleString()} XAF to ${recipientLabel} via ${disbursement_method.replace('_', ' ')}.`,
        groupId,
      });

      res.status(201).json({
        success: true,
        message: `Disbursement of ${Number(amount).toLocaleString()} XAF recorded.`,
        data: { disbursement_id: disbId },
      });
    } catch (error) { next(error); }
  },
];

// ── GET DISBURSEMENTS ──────────────────────────────────────────────────────

const getDisbursements = async (req, res, next) => {
  try {
    const { id: groupId } = req.params;
    const groupRes = await query('SELECT group_type FROM groups WHERE id = $1', [groupId]);
    const group = groupRes.rows[0];
    if (!assertFlexible(group, res)) return;

    const memberRes = await query(
      `SELECT id FROM members WHERE group_id = $1 AND user_id = $2 AND status = 'approved'`,
      [groupId, req.user.id]
    );
    if (!memberRes.rows[0]) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const r = await query(
      `SELECT fd.id, fd.amount, fd.recipient_id, fd.recipient_description,
              fd.disbursement_method, fd.note, fd.status, fd.created_at,
              u.name AS admin_name, ru.name AS recipient_name
       FROM flexible_disbursements fd
       JOIN users u ON fd.admin_id = u.id
       LEFT JOIN users ru ON fd.recipient_id = ru.id
       WHERE fd.group_id = $1
       ORDER BY fd.created_at DESC`,
      [groupId]
    );

    res.json({ success: true, data: r.rows });
  } catch (error) { next(error); }
};

// ── UPDATE DISBURSEMENT ────────────────────────────────────────────────────

const updateDisbursement = [
  body('note').optional().trim(),
  body('recipient_description').optional().trim(),
  validate,
  async (req, res, next) => {
    try {
      const { id: groupId, disbursementId } = req.params;
      const { note, recipient_description } = req.body;

      const disbRes = await query(
        `SELECT id FROM flexible_disbursements WHERE id = $1 AND group_id = $2`,
        [disbursementId, groupId]
      );
      if (!disbRes.rows[0]) {
        return res.status(404).json({ success: false, message: 'Disbursement not found' });
      }

      const result = await query(
        `UPDATE flexible_disbursements SET
           note                 = COALESCE($1, note),
           recipient_description = COALESCE($2, recipient_description),
           updated_at           = NOW()
         WHERE id = $3
         RETURNING *`,
        [note ?? null, recipient_description ?? null, disbursementId]
      );

      res.json({ success: true, data: result.rows[0] });
    } catch (error) { next(error); }
  },
];

// ── LEAVE GROUP ────────────────────────────────────────────────────────────

const leaveFlexibleGroup = async (req, res, next) => {
  try {
    const { id: groupId } = req.params;

    const groupRes = await query('SELECT * FROM groups WHERE id = $1', [groupId]);
    const group = groupRes.rows[0];
    if (!assertFlexible(group, res)) return;
    if (group.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Cannot leave a closed group' });
    }

    const memberRes = await query(
      `SELECT * FROM members WHERE group_id = $1 AND user_id = $2`,
      [groupId, req.user.id]
    );
    const member = memberRes.rows[0];
    if (!member) {
      return res.status(404).json({ success: false, message: 'You are not a member of this group' });
    }
    if (member.role === 'admin') {
      return res.status(400).json({ success: false, message: 'Admins cannot leave their own group. Transfer admin role or delete the group instead.' });
    }

    await query(`DELETE FROM members WHERE group_id = $1 AND user_id = $2`, [groupId, req.user.id]);

    // Notify admin
    const adminRes = await query(
      `SELECT user_id FROM members WHERE group_id = $1 AND role = 'admin' AND status = 'approved' LIMIT 1`,
      [groupId]
    );
    if (adminRes.rows[0]) {
      await sendNotificationToUser({
        userId: adminRes.rows[0].user_id,
        title: 'Member Left',
        message: `${req.user.name} has left the fundraiser "${group.name}".`,
        type: 'group_update',
        groupId,
      }).catch(() => {});
    }

    res.json({ success: true, message: `You have left "${group.name}".` });
  } catch (error) { next(error); }
};

module.exports = {
  createFlexibleGroup,
  updateFlexibleGroupSettings,
  activateFlexibleGroup,
  closeFlexibleGroup,
  deleteFlexibleGroup,
  leaveFlexibleGroup,
  contributeFlexible,
  getFlexiblePoolSummary,
  getFlexibleContributions,
  createDisbursement,
  getDisbursements,
  updateDisbursement,
};
