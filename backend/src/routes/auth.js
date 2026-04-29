const { Router } = require('express');
const { register, verifyOtp, login } = require('../controllers/authController');
const { authLimiter, otpLimiter } = require('../middleware/rateLimiter');

const router = Router();

router.post('/register', authLimiter, register);
router.post('/verify-otp', otpLimiter, verifyOtp);
router.post('/login', authLimiter, login);

module.exports = router;
