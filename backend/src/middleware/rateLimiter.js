const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,  // increased for development
  message: { success: false, message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'development',
});

const otpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,  // increased for development
  message: { success: false, message: 'Too many OTP requests, please wait' },
  skip: () => process.env.NODE_ENV === 'development',
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500, // increased for development
  message: { success: false, message: 'Too many requests' },
  skip: () => process.env.NODE_ENV === 'development',
});

module.exports = { authLimiter, otpLimiter, apiLimiter };
