const twilio = require('twilio');
const { query } = require('../config/database');
const { generateOTP } = require('../utils/helpers');
const logger = require('../utils/logger');

const getClient = () => {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  if (sid && sid.startsWith('AC')) {
    return twilio(sid, process.env.TWILIO_AUTH_TOKEN);
  }
  return null;
};

const sendOTP = async (phone) => {
  const code = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Invalidate previous OTPs
  await query('UPDATE otps SET is_used = TRUE WHERE phone = $1 AND is_used = FALSE', [phone]);

  // Store new OTP
  await query(
    'INSERT INTO otps (phone, code, expires_at) VALUES ($1, $2, $3)',
    [phone, code, expiresAt]
  );

  const client = getClient();
  if (client) {
    await client.messages.create({
      body: `Your Via verification code is: ${code}. Valid for 10 minutes.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone,
    });
  } else {
    // Development: log OTP
    logger.info(`[DEV] OTP for ${phone}: ${code}`);
  }

  return { success: true, message: 'OTP sent successfully' };
};

const verifyOTP = async (phone, code) => {
  const result = await query(
    `SELECT id FROM otps 
     WHERE phone = $1 AND code = $2 AND is_used = FALSE AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [phone, code]
  );

  if (!result.rows[0]) {
    return { valid: false, message: 'Invalid or expired OTP' };
  }

  await query('UPDATE otps SET is_used = TRUE WHERE id = $1', [result.rows[0].id]);
  return { valid: true };
};

module.exports = { sendOTP, verifyOTP };
