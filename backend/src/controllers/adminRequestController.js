const { query, pool } = require('../config/database');
const { sendNotificationToUser } = require('../services/notificationService');

/**
 * Compute the admin cap for a group based on approved member count.
 * Formula: MAX(1, FLOOR(approvedMemberCount / 10) * 3)
 *
 * | Approved Members | Cap |
 * |-----------------|-----|
 * | 1–9             | 1   |
 * | 10–19           | 3   |
 * | 20–29           | 6   |
 * | 30–39           | 9   |
 *
 * @param {number} approvedMemberCount
 * @returns {number}
 */
const computeAdminCap = (approvedMemberCount) => {
  return Math.max(1, Math.floor(approvedMemberCount / 10) * 3);
};

/**
 * POST /groups/:id/admin-requests
 * Submit a request to become an admin in the group.
 *
 * Guards:
 *  - Caller must be an approved member (status='approved', role='member') → 403
 *  - Current admin count must be below the computed cap → 409
 *  - No existing pending request for the same (group_id, requester_id) → 409
 *
 * On success:
 *  - INSERT into admin_requests (status='pending')
 *  - INSERT one admin_request_votes row per existing admin (vote=NULL)
 *  - Notify all admins via notificationService (type: admin_request_new)
 *  - Return 201 { success: true, data: { requestId } }
 */
const submitAdminRequest = async (req, res, next) => {
  try {
    const groupId = req.params.id;
    const requesterId = req.user.id;

    // 1. Verify caller is an approved member (role='member')
    const memberRes = await query(
      `SELECT id FROM members WHERE group_id = $1 AND user_id = $2 AND status = 'approved' AND role = 'member'`,
      [groupId, requesterId]
    );
    if (!memberRes.rows[0]) {
      return res.status(403).json({
        success: false,
        message: 'You must be an approved member to request admin role',
      });
    }

    // 2. Count approved members and current admins to evaluate the cap
    const countRes = await query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'approved') AS approved_count,
         COUNT(*) FILTER (WHERE status = 'approved' AND role = 'admin') AS admin_count
       FROM members
       WHERE group_id = $1`,
      [groupId]
    );
    const approvedMemberCount = Number(countRes.rows[0].approved_count);
    const currentAdminCount = Number(countRes.rows[0].admin_count);
    const cap = computeAdminCap(approvedMemberCount);

    if (currentAdminCount >= cap) {
      return res.status(409).json({
        success: false,
        message: 'Admin cap reached for this group size',
      });
    }

    // 3. Check for an existing pending request for this member in this group
    const existingRes = await query(
      `SELECT id FROM admin_requests WHERE group_id = $1 AND requester_id = $2 AND status = 'pending'`,
      [groupId, requesterId]
    );
    if (existingRes.rows[0]) {
      return res.status(409).json({
        success: false,
        message: 'A pending request already exists',
      });
    }

    // 4. INSERT the admin request
    const insertRes = await query(
      `INSERT INTO admin_requests (group_id, requester_id, status)
       VALUES ($1, $2, 'pending')
       RETURNING id`,
      [groupId, requesterId]
    );
    const requestId = insertRes.rows[0].id;

    // 5. Fetch all current admins in the group
    const adminsRes = await query(
      `SELECT m.user_id, u.name FROM members m
       JOIN users u ON u.id = m.user_id
       WHERE m.group_id = $1 AND m.status = 'approved' AND m.role = 'admin'`,
      [groupId]
    );
    const admins = adminsRes.rows;

    // 6. INSERT one vote row per admin (vote=NULL, awaiting decision)
    if (admins.length > 0) {
      const votePlaceholders = admins
        .map((_, i) => `($1, $${i + 2})`)
        .join(', ');
      const voteValues = [requestId, ...admins.map((a) => a.user_id)];
      await query(
        `INSERT INTO admin_request_votes (request_id, admin_id) VALUES ${votePlaceholders}`,
        voteValues
      );
    }

    // 7. Notify all admins
    const requesterName = req.user.name;
    await Promise.all(
      admins.map((admin) =>
        sendNotificationToUser({
          userId: admin.user_id,
          title: 'New Admin Request',
          message: `${requesterName} has requested the admin role in this group.`,
          type: 'admin_request_new',
          groupId,
        })
      )
    );

    return res.status(201).json({ success: true, data: { requestId } });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /groups/:id/admin-requests/:requestId/vote
 * Cast a vote (approved | rejected) on a pending admin request.
 *
 * Guards:
 *  - Caller must be an admin in the group (status='approved', role='admin') → 403
 *  - Admin request must exist for the given requestId + group_id → 404
 *  - Request must have status='pending' → 409
 *  - Caller must have a vote row with vote=NULL → 409 if already voted or no row
 *  - vote value must be 'approved' or 'rejected' → 400
 *
 * On rejection:
 *  - UPDATE admin_requests SET status='rejected'
 *  - Notify requester (admin_request_rejected)
 *  - Notify all other admins (admin_request_rejected_peer)
 *  - Return 200 { success: true, message: 'Request rejected' }
 *
 * On approval:
 *  - If not all votes are 'approved' yet: return 200 { success: true, message: 'Vote recorded' }
 *  - If all votes are 'approved': within a single transaction:
 *    - UPDATE members SET role='admin'
 *    - UPDATE admin_requests SET status='approved'
 *    - Notify requester (admin_request_approved)
 *    - Return 200 { success: true, message: 'Request approved, member promoted to admin' }
 */
const voteOnAdminRequest = async (req, res, next) => {
  try {
    const groupId = req.params.id;
    const requestId = req.params.requestId;
    const callerId = req.user.id;
    const { vote, rejection_reason } = req.body;

    // 1. Verify caller is an admin in the group
    const adminRes = await query(
      `SELECT id FROM members WHERE group_id = $1 AND user_id = $2 AND status = 'approved' AND role = 'admin'`,
      [groupId, callerId]
    );
    if (!adminRes.rows[0]) {
      return res.status(403).json({
        success: false,
        message: 'Only group admins can vote',
      });
    }

    // 2. Fetch the admin request by requestId and group_id
    const requestRes = await query(
      `SELECT ar.id, ar.status, ar.requester_id, u.name AS requester_name, g.name AS group_name
       FROM admin_requests ar
       JOIN users u ON u.id = ar.requester_id
       JOIN groups g ON g.id = ar.group_id
       WHERE ar.id = $1 AND ar.group_id = $2`,
      [requestId, groupId]
    );
    if (!requestRes.rows[0]) {
      return res.status(404).json({
        success: false,
        message: 'Admin request not found',
      });
    }
    const adminRequest = requestRes.rows[0];

    // 3. Verify request is still pending
    if (adminRequest.status !== 'pending') {
      return res.status(409).json({
        success: false,
        message: 'Request is no longer pending',
      });
    }

    // 4. Verify caller has a vote row with vote=NULL (not yet voted)
    const voteRowRes = await query(
      `SELECT id FROM admin_request_votes WHERE request_id = $1 AND admin_id = $2`,
      [requestId, callerId]
    );
    if (!voteRowRes.rows[0]) {
      return res.status(409).json({
        success: false,
        message: 'You have already voted on this request',
      });
    }
    const voteRow = voteRowRes.rows[0];

    // Check if vote is already cast (not NULL)
    const existingVoteRes = await query(
      `SELECT vote FROM admin_request_votes WHERE id = $1`,
      [voteRow.id]
    );
    if (existingVoteRes.rows[0]?.vote !== null) {
      return res.status(409).json({
        success: false,
        message: 'You have already voted on this request',
      });
    }

    // 5. Validate vote value
    if (vote !== 'approved' && vote !== 'rejected') {
      return res.status(400).json({
        success: false,
        message: "Vote must be 'approved' or 'rejected'",
      });
    }

    // 6. Record the vote
    await query(
      `UPDATE admin_request_votes
       SET vote = $1, rejection_reason = $2, voted_at = NOW()
       WHERE request_id = $3 AND admin_id = $4`,
      [vote, rejection_reason || null, requestId, callerId]
    );

    // Handle rejection
    if (vote === 'rejected') {
      // Update request status to rejected
      await query(
        `UPDATE admin_requests SET status = 'rejected', updated_at = NOW() WHERE id = $1`,
        [requestId]
      );

      // Notify requester
      const rejectionMsg = rejection_reason
        ? `Your admin request was denied. Reason: ${rejection_reason}`
        : 'Your admin request was denied.';
      await sendNotificationToUser({
        userId: adminRequest.requester_id,
        title: 'Admin Request Denied',
        message: rejectionMsg,
        type: 'admin_request_rejected',
        groupId,
      });

      // Notify all other admins (not the rejecting admin)
      const peerAdminsRes = await query(
        `SELECT m.user_id FROM members m
         WHERE m.group_id = $1 AND m.status = 'approved' AND m.role = 'admin' AND m.user_id != $2`,
        [groupId, callerId]
      );
      const callerName = req.user.name;
      const peerMsg = rejection_reason
        ? `${callerName} rejected an admin request. Reason: ${rejection_reason}`
        : `${callerName} rejected an admin request.`;
      await Promise.all(
        peerAdminsRes.rows.map((admin) =>
          sendNotificationToUser({
            userId: admin.user_id,
            title: 'Admin Request Rejected',
            message: peerMsg,
            type: 'admin_request_rejected_peer',
            groupId,
          })
        )
      );

      return res.status(200).json({ success: true, message: 'Request rejected' });
    }

    // Handle approval — check if all votes are now 'approved'
    const allVotesRes = await query(
      `SELECT vote FROM admin_request_votes WHERE request_id = $1`,
      [requestId]
    );
    const allApproved = allVotesRes.rows.every((r) => r.vote === 'approved');

    if (!allApproved) {
      return res.status(200).json({ success: true, message: 'Vote recorded' });
    }

    // All votes approved — promote member within a single transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE members SET role = 'admin', updated_at = NOW()
         WHERE group_id = $1 AND user_id = $2`,
        [groupId, adminRequest.requester_id]
      );

      await client.query(
        `UPDATE admin_requests SET status = 'approved', updated_at = NOW() WHERE id = $1`,
        [requestId]
      );

      await client.query('COMMIT');
    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }

    // Notify requester of approval
    await sendNotificationToUser({
      userId: adminRequest.requester_id,
      title: 'Admin Request Approved',
      message: `You have been granted admin privileges in ${adminRequest.group_name}`,
      type: 'admin_request_approved',
      groupId,
    });

    return res.status(200).json({
      success: true,
      message: 'Request approved, member promoted to admin',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /groups/:id/admin-requests
 * Return all admin requests for the group with requester name and per-admin vote summary.
 *
 * Guards:
 *  - Caller must be an admin in the group (status='approved', role='admin') → 403 "Access denied"
 *
 * Response: 200 { success: true, data: AdminRequest[] }
 * Each AdminRequest includes:
 *  - id, group_id, requester_id, requester_name, status, created_at
 *  - votes: [{ admin_id, admin_name, vote }]
 */
const getAdminRequests = async (req, res, next) => {
  try {
    const groupId = req.params.id;
    const callerId = req.user.id;

    // 1. Verify caller is an admin in the group
    const adminRes = await query(
      `SELECT id FROM members WHERE group_id = $1 AND user_id = $2 AND status = 'approved' AND role = 'admin'`,
      [groupId, callerId]
    );
    if (!adminRes.rows[0]) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // 2. Fetch all admin requests for the group with requester name
    const requestsRes = await query(
      `SELECT ar.id, ar.group_id, ar.requester_id, u.name AS requester_name,
              ar.status, ar.created_at
       FROM admin_requests ar
       JOIN users u ON u.id = ar.requester_id
       WHERE ar.group_id = $1
       ORDER BY ar.created_at DESC`,
      [groupId]
    );

    if (requestsRes.rows.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    // 3. Fetch all vote rows for these requests with admin names
    const requestIds = requestsRes.rows.map((r) => r.id);
    const votesRes = await query(
      `SELECT arv.request_id, arv.admin_id, u.name AS admin_name, arv.vote
       FROM admin_request_votes arv
       JOIN users u ON u.id = arv.admin_id
       WHERE arv.request_id = ANY($1::uuid[])`,
      [requestIds]
    );

    // 4. Group votes by request_id
    const votesByRequest = {};
    for (const vote of votesRes.rows) {
      if (!votesByRequest[vote.request_id]) {
        votesByRequest[vote.request_id] = [];
      }
      votesByRequest[vote.request_id].push({
        admin_id: vote.admin_id,
        admin_name: vote.admin_name,
        vote: vote.vote,
      });
    }

    // 5. Assemble final response
    const data = requestsRes.rows.map((r) => ({
      id: r.id,
      group_id: r.group_id,
      requester_id: r.requester_id,
      requester_name: r.requester_name,
      status: r.status,
      created_at: r.created_at,
      votes: votesByRequest[r.id] || [],
    }));

    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /groups/:id/admin-requests/my
 * Return the caller's own admin request for the group, or null if none exists.
 *
 * Guards:
 *  - Caller must be a member of the group (any status='approved') → 403 "Access denied"
 *
 * Response: 200 { success: true, data: AdminRequest | null }
 */
const getMyAdminRequest = async (req, res, next) => {
  try {
    const groupId = req.params.id;
    const callerId = req.user.id;

    // 1. Verify caller is a member of the group (approved, any role)
    const memberRes = await query(
      `SELECT id FROM members WHERE group_id = $1 AND user_id = $2 AND status = 'approved'`,
      [groupId, callerId]
    );
    if (!memberRes.rows[0]) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // 2. Fetch the caller's own admin request for this group (any status)
    const requestRes = await query(
      `SELECT ar.id, ar.group_id, ar.requester_id, u.name AS requester_name,
              ar.status, ar.created_at
       FROM admin_requests ar
       JOIN users u ON u.id = ar.requester_id
       WHERE ar.group_id = $1 AND ar.requester_id = $2
       ORDER BY ar.created_at DESC
       LIMIT 1`,
      [groupId, callerId]
    );

    if (!requestRes.rows[0]) {
      return res.status(200).json({ success: true, data: null });
    }

    const adminRequest = requestRes.rows[0];

    // 3. Fetch votes for this request
    const votesRes = await query(
      `SELECT arv.admin_id, u.name AS admin_name, arv.vote
       FROM admin_request_votes arv
       JOIN users u ON u.id = arv.admin_id
       WHERE arv.request_id = $1`,
      [adminRequest.id]
    );

    const data = {
      id: adminRequest.id,
      group_id: adminRequest.group_id,
      requester_id: adminRequest.requester_id,
      requester_name: adminRequest.requester_name,
      status: adminRequest.status,
      created_at: adminRequest.created_at,
      votes: votesRes.rows.map((v) => ({
        admin_id: v.admin_id,
        admin_name: v.admin_name,
        vote: v.vote,
      })),
    };

    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

module.exports = { submitAdminRequest, voteOnAdminRequest, computeAdminCap, getAdminRequests, getMyAdminRequest };
