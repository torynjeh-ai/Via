const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { body } = require('express-validator');
const { query } = require('../config/database');
const { sendOTP, verifyOTP } = require('../services/otpService');
const { validate } = require('../middleware/validate');
const walletService = require('../services/walletService');
const { recalculateTrustScore } = require('../services/trustScoreService');

const generateToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// ── Register: store pending, send OTP, do NOT create user yet ─────────────
const register = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('phone').trim().matches(/^\+?[1-9]\d{8,14}$/).withMessage('Valid phone number required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  validate,
  async (req, res, next) => {
    try {
      const { name, phone, password } = req.body;

      // Block if a verified account already exists
      const existing = await query(
        'SELECT id, is_verified FROM users WHERE phone = $1',
        [phone]
      );
      if (existing.rows[0]?.is_verified) {
        return res.status(409).json({ success: false, message: 'Phone number already registered' });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      // Upsert pending registration — overwrites if they retry
      await query(
        `INSERT INTO pending_registrations (phone, name, password_hash, expires_at)
         VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes')
         ON CONFLICT (phone) DO UPDATE SET
           name          = EXCLUDED.name,
           password_hash = EXCLUDED.password_hash,
           expires_at    = NOW() + INTERVAL '10 minutes'`,
        [phone, name, passwordHash]
      );

      // Send OTP — user record is NOT created yet
      const otpResult = await sendOTP(phone);

      res.status(200).json({
        success: true,
        message: otpResult.message || 'OTP sent to your phone. Please verify to complete registration.',
        data: {
          phone,
          // Include fallback_code if Twilio failed — frontend will display it
          ...(otpResult.fallback_code && { fallback_code: otpResult.fallback_code }),
        },
      });
    } catch (error) { next(error); }
  },
];

// ── Verify OTP: create user only after successful verification ────────────
const verifyOtp = [
  body('phone').trim().notEmpty().withMessage('Phone is required'),
  body('code').trim().isLength({ min: 6, max: 6 }).withMessage('Valid OTP required'),
  validate,
  async (req, res, next) => {
    try {
      const { phone, code } = req.body;

      const [pendingRes, existingRes] = await Promise.all([
        query('SELECT * FROM pending_registrations WHERE phone = $1 AND expires_at > NOW()', [phone]),
        query('SELECT id FROM users WHERE phone = $1', [phone]),
      ]);

      const pending      = pendingRes.rows[0];
      const existingUser = existingRes.rows[0];

      // Verify OTP
      const result = await verifyOTP(phone, code);
      if (!result.valid) {
        return res.status(400).json({ success: false, message: result.message });
      }

      // ── New registration: create user now ─────────────────────────────────
      if (pending && !existingUser) {
        const userResult = await query(
          `INSERT INTO users (name, phone, password_hash, is_verified)
           VALUES ($1, $2, $3, TRUE)
           RETURNING id, name, phone, role, tc_balance, wallet_code, preferred_currency,
                     is_verified, profile_complete, profile_picture_url`,
          [pending.name, phone, pending.password_hash]
        );
        const user = userResult.rows[0];

        await query('INSERT INTO notification_preferences (user_id) VALUES ($1)', [user.id]);
        await walletService.initWallet(user.id);
        await query('DELETE FROM pending_registrations WHERE phone = $1', [phone]);

        const token = generateToken(user.id);
        // Calculate initial trust score (phone verified = 20 pts)
        await recalculateTrustScore(user.id);
        return res.json({ success: true, message: 'Phone verified successfully', data: { token, user } });
      }

      // ── Existing user (login OTP flow) ────────────────────────────────────
      if (existingUser) {
        const userResult = await query(
          `UPDATE users SET is_verified = TRUE WHERE phone = $1
           RETURNING id, name, phone, role, tc_balance, wallet_code, preferred_currency,
                     is_verified, profile_complete, profile_picture_url`,
          [phone]
        );
        const user  = userResult.rows[0];
        const token = generateToken(user.id);
        return res.json({ success: true, message: 'Phone verified successfully', data: { token, user } });
      }

      return res.status(400).json({
        success: false,
        message: 'Registration session expired. Please register again.',
      });
    } catch (error) { next(error); }
  },
];

// ── Login ─────────────────────────────────────────────────────────────────
const login = [
  body('phone').trim().notEmpty().withMessage('Phone is required'),
  validate,
  async (req, res, next) => {
    try {
      const { phone, password } = req.body;
      const userResult = await query(
        `SELECT id, name, phone, role, tc_balance, wallet_code, preferred_currency,
                is_verified, is_active, profile_complete, profile_picture_url, password_hash
         FROM users WHERE phone = $1`,
        [phone]
      );
      const user = userResult.rows[0];
      if (!user || !user.is_active) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }
      if (!user.is_verified) {
        return res.status(403).json({ success: false, message: 'Phone number not verified' });
      }
      if (password && user.password_hash) {
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(401).json({ success: false, message: 'Invalid credentials' });
      } else {
        const otpResult = await sendOTP(phone);
        return res.json({
          success: true,
          message: otpResult.message || 'OTP sent to your phone.',
          data: {
            ...(otpResult.fallback_code && { fallback_code: otpResult.fallback_code }),
          },
        });
      }
      const token = generateToken(user.id);
      const { password_hash, ...safeUser } = user;
      res.json({ success: true, message: 'Login successful', data: { token, user: safeUser } });
    } catch (error) { next(error); }
  },
];

module.exports = { register, verifyOtp, login };
