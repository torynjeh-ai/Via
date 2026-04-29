const { body } = require('express-validator');
const { query } = require('../config/database');
const { validate } = require('../middleware/validate');
const { compareFaces } = require('../services/faceMatchService');

const getMe = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, name, phone, role, tc_balance, wallet_code, preferred_currency, is_verified, profile_complete, doc_type, doc_number, profile_picture_url, created_at FROM users WHERE id = $1`,
      [req.user.id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) { next(error); }
};

const updateMe = [
  body('name').optional().trim().notEmpty(),
  body('fcm_token').optional().trim(),
  body('profile_picture').optional().isBase64().withMessage('Profile picture must be valid base64'),
  validate,
  async (req, res, next) => {
    try {
      const { name, fcm_token, profile_picture } = req.body;
      
      // Prepare profile picture data
      let profilePictureUrl = null;
      if (profile_picture) {
        // Add data URL prefix if not present
        profilePictureUrl = profile_picture.startsWith('data:') 
          ? profile_picture 
          : `data:image/jpeg;base64,${profile_picture}`;
      }
      
      const result = await query(
        `UPDATE users SET 
         name = COALESCE($1, name), 
         fcm_token = COALESCE($2, fcm_token),
         profile_picture_url = COALESCE($3, profile_picture_url),
         updated_at = NOW()
         WHERE id = $4 
         RETURNING id, name, phone, role, tc_balance, profile_picture_url`,
        [name, fcm_token, profilePictureUrl, req.user.id]
      );
      res.json({ success: true, data: result.rows[0] });
    } catch (error) { next(error); }
  },
];

const getMyGroups = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT g.*, m.role as my_role, m.status as my_status FROM groups g
       JOIN members m ON g.id = m.group_id WHERE m.user_id = $1 ORDER BY g.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) { next(error); }
};

const getNotifications = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) { next(error); }
};

const markRead = async (req, res, next) => {
  try {
    await query(`UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (error) { next(error); }
};

// POST /users/me/setup-profile
const setupProfile = [
  body('doc_type').isIn(['passport', 'id']).withMessage('Document type must be passport or id'),
  body('doc_number').trim().notEmpty().withMessage('Document number is required'),
  body('doc_image').notEmpty().withMessage('Document image is required'),
  body('face_image').notEmpty().withMessage('Face image is required'),
  validate,
  async (req, res, next) => {
    try {
      // One-time only
      if (req.user.profile_complete) {
        return res.status(403).json({ success: false, message: 'Profile verification already completed' });
      }

      const { doc_type, doc_number, doc_image, face_image } = req.body;

      // Check doc number not already used by another user
      const existing = await query(
        'SELECT id FROM users WHERE doc_number = $1 AND id != $2',
        [doc_number, req.user.id]
      );
      if (existing.rows[0]) {
        return res.status(409).json({ success: false, message: 'Document number already registered to another account' });
      }

      // Face match against document photo
      const faceResult = await compareFaces(doc_image, face_image);
      if (!faceResult.match) {
        return res.status(400).json({ success: false, message: 'Face does not match the document photo. Please try again.' });
      }

      const result = await query(
        `UPDATE users SET
          doc_type = $1,
          doc_number = $2,
          passport_image_url = $3,
          face_image_url = $4,
          profile_complete = TRUE,
          updated_at = NOW()
         WHERE id = $5
         RETURNING id, name, phone, role, tc_balance, is_verified, profile_complete, doc_type, doc_number`,
        [doc_type, doc_number, doc_image, face_image, req.user.id]
      );

      res.json({ success: true, message: 'Identity verified successfully', data: result.rows[0] });
    } catch (error) { next(error); }
  },
];

// POST /users/me/profile-picture
const updateProfilePicture = [
  body('profile_picture').notEmpty().withMessage('Profile picture is required'),
  validate,
  async (req, res, next) => {
    try {
      const { profile_picture } = req.body;
      
      // Add data URL prefix if not present
      const profilePictureUrl = profile_picture.startsWith('data:') 
        ? profile_picture 
        : `data:image/jpeg;base64,${profile_picture}`;
      
      const result = await query(
        `UPDATE users SET 
         profile_picture_url = $1,
         updated_at = NOW()
         WHERE id = $2 
         RETURNING id, name, phone, role, tc_balance, profile_picture_url`,
        [profilePictureUrl, req.user.id]
      );
      
      res.json({ success: true, message: 'Profile picture updated successfully', data: result.rows[0] });
    } catch (error) { next(error); }
  },
];

module.exports = { getMe, updateMe, getMyGroups, getNotifications, markRead, setupProfile, updateProfilePicture };
