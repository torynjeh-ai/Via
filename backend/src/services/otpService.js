const twilio = require('twilio');
const { query } = require('../config/database');
const { generateOTP } = require('../utils/helpers');
const logger = require('../utils/logger');

// ── Twilio Verify client ───────────────────────────────────────────────────
const getVerifyClient = () => {
  const sid       = process.env.TWILIO_ACCOUNT_SID;
  const token     = process.env.TWILIO_AUTH_TOKEN;
  const verifySid = process.env.TWILIO_VERIFY_SID;

  if (sid && sid.startsWith('AC') && token && verifySid && verifySid.startsWith('VA')) {
    return { client: twilio(sid, token), verifySid };
  }
  return null;
};

/**
 * Send an OTP to the given phone number.
 *
 * Uses Twilio Verify if configured, otherwise falls back to DB-stored OTP
 * and returns the code directly in the response so the frontend can display it.
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
    } catch (err) {
      // Log the full Twilio error so we can diagnose it
      logger.error(`[OTP] Twilio Verify FAILED for ${phone}: [${err.code}] ${err.message}`);
      logger.warn(`[OTP] Falling back to DB OTP for ${phone}`);
      // Fall through to DB fallback below
    }
  } else {
    logger.warn('[OTP] Twilio not configured — using DB fallback');
  }

  // ── Fallback: store OTP in DB and return it directly ──────────────────
  const code      = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await query('UPDATE otps SET is_used = TRUE WHERE phone = $1 AND is_used = FALSE', [phone]);
  await query('INSERT INTO otps (phone, code, expires_at) VALUES ($1, $2, $3)', [phone, code, expiresAt]);

  logger.info(`[OTP] Fallback OTP for ${phone}: ${code}`);

  return {
    success: true,
    message: `SMS unavailable. Your verification code is: ${code}`,
    fallback_code: code,
  };
};

/**
 * Verify an OTP code for the given phone number.
 *
 * Delegates to Twilio Verify if configured, then falls back to local DB check.
 */
const verifyOTP = async (phone, code) => {
  const verify = getVerifyClient();

  if (verify) {
    try {
      const check = await verify.client.verify.v2
        .services(verify.verifySid)
        .verificationChecks
        .create({ to: phone, code });

      logger.info(`[OTP] Twilio Verify check for ${phone}: status=${check.status}`);

      if (check.status === 'approved') {
        return { valid: true };
      }
      // Twilio returned non-approved — also check local DB in case we fell back
    } catch (err) {
      logger.error(`[OTP] Twilio Verify check FAILED for ${phone}: [${err.code}] ${err.message}`);
      // Fall through to DB check
    }
  }

  // ── DB fallback check ─────────────────────────────────────────────────
  const result = await query(
    `SELECT id FROM otps
     WHERE phone = $1 AND code = $2 AND is_used = FALSE AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [phone, code]
  );
  logger.info(`[OTP] DB check for ${phone} code=${code}: found=${!!result.rows[0]}`);
  if (!result.rows[0]) return { valid: false, message: 'Invalid or expired OTP' };
  await query('UPDATE otps SET is_used = TRUE WHERE id = $1', [result.rows[0].id]);
  return { valid: true };
};

module.exports = { sendOTP, verifyOTP };
