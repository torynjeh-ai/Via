const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const { query } = require('../config/database');
const { sendOTP, verifyOTP } = require('../services/otpService');
const { validate } = require('../middleware/validate');
const walletService = require('../services/walletService');

const generateToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

const register = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('phone').trim().matches(/^\+?[1-9]\d{8,14}$/).withMessage('Valid phone number required'),
  body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  validate,
  async (req, res, next) => {
    try {
      const { name, phone, password } = req.body;
      const existing = await query('SELECT id FROM users WHERE phone = $1', [phone]);
      if (existing.rows[0]) return res.status(409).json({ success: false, message: 'Phone number already registered' });
      const passwordHash = password ? await bcrypt.hash(password, 12) : null;
      const result = await query(
        'INSERT INTO users (name, phone, password_hash) VALUES ($1, $2, $3) RETURNING id, name, phone, role',
        [name, phone, passwordHash]
      );
      await query('INSERT INTO notification_preferences (user_id) VALUES ($1)', [result.rows[0].id]);
      await walletService.initWallet(result.rows[0].id);
      await sendOTP(phone);
      res.status(201).json({ success: true, message: 'Registration successful. OTP sent to your phone.', data: { userId: result.rows[0].id, phone } });
    } catch (error) { next(error); }
  },
];

const verifyOtp = [
  body('phone').trim().notEmpty().withMessage('Phone is required'),
  body('code').trim().isLength({ min: 6, max: 6 }).withMessage('Valid OTP required'),
  validate,
  async (req, res, next) => {
    try {
      const { phone, code } = req.body;
      const result = await verifyOTP(phone, code);
      if (!result.valid) return res.status(400).json({ success: false, message: result.message });
      const userResult = await query(
        'UPDATE users SET is_verified = TRUE WHERE phone = $1 RETURNING id, name, phone, role, tc_balance',
        [phone]
      );
      const user = userResult.rows[0];
      const token = generateToken(user.id);
      res.json({ success: true, message: 'Phone verified successfully', data: { token, user } });
    } catch (error) { next(error); }
  },
];

const login = [
  body('phone').trim().notEmpty().withMessage('Phone is required'),
  validate,
  async (req, res, next) => {
    try {
      const { phone, password } = req.body;
      const userResult = await query(
        'SELECT id, name, phone, role, tc_balance, is_verified, is_active, password_hash FROM users WHERE phone = $1',
        [phone]
      );
      const user = userResult.rows[0];
      if (!user || !user.is_active) return res.status(401).json({ success: false, message: 'Invalid credentials' });
      if (!user.is_verified) return res.status(403).json({ success: false, message: 'Phone number not verified' });
      if (password && user.password_hash) {
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(401).json({ success: false, message: 'Invalid credentials' });
      } else {
        await sendOTP(phone);
        return res.json({ success: true, message: 'OTP sent to your phone.' });
      }
      const token = generateToken(user.id);
      const { password_hash, ...safeUser } = user;
      res.json({ success: true, message: 'Login successful', data: { token, user: safeUser } });
    } catch (error) { next(error); }
  },
];

module.exports = { register, verifyOtp, login };
