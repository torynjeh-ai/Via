const { query } = require('../config/database');

// GET /admin/users — all users with location, verification, wallet info
const getUsers = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT
         u.id, u.name, u.phone, u.role, u.is_verified, u.profile_complete,
         u.tc_balance, u.city, u.country, u.latitude, u.longitude,
         u.location_enabled, u.last_location_at, u.created_at, u.is_active,
         COUNT(DISTINCT m.group_id) as group_count
       FROM users u
       LEFT JOIN members m ON m.user_id = u.id AND m.status = 'approved'
       GROUP BY u.id
       ORDER BY u.created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) { next(error); }
};

// GET /admin/stats — platform-wide stats
const getStats = async (req, res, next) => {
  try {
    const [usersRes, groupsRes, contribRes, pendingRes] = await Promise.all([
      query(`SELECT
               COUNT(*) as total,
               SUM(CASE WHEN is_verified THEN 1 ELSE 0 END) as verified,
               SUM(CASE WHEN profile_complete THEN 1 ELSE 0 END) as identity_verified,
               SUM(CASE WHEN location_enabled THEN 1 ELSE 0 END) as location_enabled
             FROM users`),
      query(`SELECT
               COUNT(*) as total,
               SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
               SUM(CASE WHEN status = 'forming' THEN 1 ELSE 0 END) as forming,
               SUM(CASE WHEN status = 're-forming' THEN 1 ELSE 0 END) as reforming
             FROM groups`),
      query(`SELECT
               COUNT(*) as total,
               SUM(amount) as total_xaf
             FROM contributions WHERE status = 'completed'`),
      query(`SELECT COUNT(*) as total FROM pending_registrations WHERE expires_at > NOW()`),
    ]);

    res.json({
      success: true,
      data: {
        users:        usersRes.rows[0],
        groups:       groupsRes.rows[0],
        contributions: contribRes.rows[0],
        pending_registrations: pendingRes.rows[0].total,
      },
    });
  } catch (error) { next(error); }
};

// PATCH /admin/users/:id — update user role or active status
const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role, is_active } = req.body;

    const result = await query(
      `UPDATE users SET
         role      = COALESCE($1, role),
         is_active = COALESCE($2, is_active),
         updated_at = NOW()
       WHERE id = $3
       RETURNING id, name, phone, role, is_active, is_verified, profile_complete`,
      [role ?? null, is_active ?? null, id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, message: 'User updated', data: result.rows[0] });
  } catch (error) { next(error); }
};

// GET /admin/locations — users with location data
const getUserLocations = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, name, phone, role, city, country, latitude, longitude,
              location_enabled, last_location_at
       FROM users
       WHERE latitude IS NOT NULL
       ORDER BY last_location_at DESC NULLS LAST`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) { next(error); }
};

// GET /admin/groups — all groups with member counts, status, and invitation chain
const getGroups = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT
         g.id, g.name, g.description, g.status, g.group_type,
         g.contribution_amount, g.cycle, g.max_members,
         g.circle_number, g.visibility, g.created_at,
         u.name as creator_name, u.phone as creator_phone,
         COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'approved') as member_count,
         SUM(c.amount) FILTER (WHERE c.status = 'completed') as total_contributed
       FROM groups g
       LEFT JOIN users u ON g.created_by = u.id
       LEFT JOIN members m ON m.group_id = g.id
       LEFT JOIN contributions c ON c.group_id = g.id
       GROUP BY g.id, u.name, u.phone
       ORDER BY g.created_at DESC`
    );

    // For each group, also fetch member list with invitation chain
    const groups = result.rows;
    for (const group of groups) {
      const membersRes = await query(
        `SELECT
           m.user_id, m.role, m.status, m.joined_at,
           u.name, u.phone,
           inv.name as invited_by_name, inv.phone as invited_by_phone
         FROM members m
         JOIN users u ON m.user_id = u.id
         LEFT JOIN users inv ON m.invited_by = inv.id
         WHERE m.group_id = $1
         ORDER BY m.joined_at ASC`,
        [group.id]
      );
      group.members = membersRes.rows;
    }

    res.json({ success: true, data: groups });
  } catch (error) { next(error); }
};

// GET /admin/financials — superadmin only: platform financial summary
const getFinancials = async (req, res, next) => {
  try {
    const [walletRes, penaltyRes, withdrawalRes, topupRes] = await Promise.all([
      query(`SELECT SUM(tc_balance) as total_tc, COUNT(*) as users_with_balance
             FROM users WHERE tc_balance > 0`),
      query(`SELECT SUM(platform_fee) as total_platform_fees, COUNT(*) as distributions
             FROM penalty_distributions`),
      query(`SELECT COUNT(*) as pending_count, SUM(xaf_amount) as pending_xaf
             FROM wallet_transactions WHERE type = 'withdrawal' AND status = 'pending'`),
      query(`SELECT COUNT(*) as total_topups, SUM(xaf_amount) as total_topup_xaf
             FROM wallet_transactions WHERE type = 'top_up' AND status = 'completed'`),
    ]);
    res.json({
      success: true,
      data: {
        wallet: walletRes.rows[0],
        penalties: penaltyRes.rows[0],
        pending_withdrawals: withdrawalRes.rows[0],
        top_ups: topupRes.rows[0],
      },
    });
  } catch (error) { next(error); }
};

module.exports = { getUsers, getStats, updateUser, getUserLocations, getGroups, getFinancials };
