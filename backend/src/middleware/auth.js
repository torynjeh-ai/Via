const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

const requireProfileComplete = (req, res, next) => {
  if (!req.user.profile_complete) {
    return res.status(403).json({
      success: false,
      code: 'PROFILE_INCOMPLETE',
      message: 'Please complete your profile setup (passport & face verification) before proceeding.',
    });
  }
  next();
};

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await query(
      'SELECT id, name, phone, role, tc_balance, is_verified, is_active, profile_complete FROM users WHERE id = $1',
      [decoded.userId]
    );
    if (!result.rows[0] || !result.rows[0].is_active) {
      return res.status(401).json({ success: false, message: 'User not found or inactive' });
    }
    req.user = result.rows[0];
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

const requireAdmin = async (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

const requireGroupAdmin = async (req, res, next) => {
  try {
    const groupId = req.params.groupId || req.params.id || req.body.groupId;
    const result = await query(
      'SELECT role FROM members WHERE user_id = $1 AND group_id = $2 AND status = $3',
      [req.user.id, groupId, 'approved']
    );
    if (!result.rows[0] || result.rows[0].role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Group admin access required' });
    }
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { authenticate, requireAdmin, requireGroupAdmin, requireProfileComplete };
