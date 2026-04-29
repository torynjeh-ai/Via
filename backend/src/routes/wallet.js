const { Router } = require('express');
const { authenticate, requireProfileComplete } = require('../middleware/auth');
const {
  getWallet,
  topUp,
  withdraw,
  transfer,
  getTransferPreview,
  getTransactions,
} = require('../controllers/walletController');

const router = Router();

// All wallet routes require authentication
router.use(authenticate);

// Read routes — accessible to all authenticated users (including unverified)
router.get('/', getWallet);
router.get('/transactions', getTransactions);

// Top-up — accessible to unverified users (Requirement 11.9)
router.post('/topup', topUp);

// Debit routes — require profile complete (Requirement 11.1)
router.post('/withdraw', requireProfileComplete, withdraw);
router.post('/transfer', requireProfileComplete, transfer);
router.get('/transfer/preview', requireProfileComplete, getTransferPreview);

module.exports = router;
