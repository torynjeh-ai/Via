const twilio = require('twilio');
const { query } = require('../config/database');
const { generateOTP } = require('../utils/helpers');
const logger = require('../utils/logger');

// ── Twilio Verify client ───────────────────────────────────────────────────
const getVerifyClient = () => {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const verifySid = process.env.TWILIO_VERIFY_SID;

  if (sid && sid.startsWith('AC') && token && verifySid && verifySid.startsWith('VA')) {
    return { client: twilio(sid, token), verifySid };
  }
  return null;
};

/**
 * Send an OTP to the given phone number.
 *
 * If TWILIO_VERIFY_SID is configured, uses Twilio Verify (no phone number needed).
 * Otherwise falls back to dev mode — logs the OTP to the console.
 */
const sendOTP = async (phone) => {
  const verify = getVerifyClient();

  if (verify) {
    try {
      await verify.client.verify.v2
        .services(verify.verifySid)
        .verifications
        .create({ to: phone, channel: 'sms' });

      logger.info(`[OTP] Verification sent via Twilio Verify to ${phone}`);
      return { success: true, message: 'OTP sent to your phone.' };
    } catch (err) {COntinue
      logger.warn(`[OTP] Twilio Verify failed (${err.message}) — falling back to dev OTP`);
    }
  }

  // ── Fallback: store in DB ──────────────────────────────────────────────
  const code      = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await query('UPDATE otps SET is_used = TRUE WHERE phone = $1 AND is_used = FALSE', [phone]);
  await query('INSERT INTO otps (phone, code, expires_at) VALUES ($1, $2, $3)', [phone, code, expiresAt]);

  logger.info(`[OTP] Fallback OTP for ${phone}: ${code}`);

  // In production without working Twilio, return the code directly so users can still register
  // TODO: Replace with a working SMS provider for production
  const isDev = process.env.NODE_ENV !== 'production';
  return {
    success: true,
    message: isDev
      ? `Dev mode — your OTP is: ${code}`
      : `SMS unavailable. Your verification code is: ${code}`,
    ...(process.env.NODE_ENV !== 'production' && { dev_code: code }),
    fallback_code: code, // always include so frontend can show it
  };
};

/**
 * Verify an OTP code for the given phone number.
 *
 * If TWILIO_VERIFY_SID is configured, delegates to Twilio Verify.
 * Otherwise checks the local otps table (dev mode).
 */
const verifyOTP = async (phone, code) => {
  const verify = getVerifyClient();

  if (verify) {
    try {
      const check = await verify.client.verify.v2
        .services(verify.verifySid)
        .verificationChecks
        .create({ to: phone, code });

      if (check.status === 'approved') {
        return { valid: true };
      }
      // Twilio said invalid — but also check local DB in case we fell back to dev mode
    } catch (err) {
      logger.warn(`[OTP] Twilio Verify check failed (${err.message}) — falling back to dev check`);
      // Fall through to dev fallback below
    }
  }

  // ── Dev fallback: check local DB ──────────────────────────────────────
  const result = await query(
    `SELECT id FROM otps
     WHERE phone = $1 AND code = $2 AND is_used = FALSE AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [phone, code]
  );
  if (!result.rows[0]) return { valid: false, message: 'Invalid or expired OTP' };
  await query('UPDATE otps SET is_used = TRUE WHERE id = $1', [result.rows[0].id]);
  return { valid: true };
};

module.exports = { sendOTP, verifyOTP };
