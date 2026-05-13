const { body, query: queryValidator, validationResult } = require('express-validator');
const { validate } = require('../middleware/validate');
const walletService = require('../services/walletService');
const { recalculateTrustScore } = require('../services/trustScoreService');

const VALID_PAYMENT_METHODS = ['mtn_momo', 'orange_money', 'bank_transfer', 'card', 'apple_pay', 'paypal'];
const VALID_TX_TYPES = ['top_up', 'withdrawal', 'contribution', 'payout', 'transfer_in', 'transfer_out'];

/**
 * GET /wallet
 * Returns wallet info: tc_balance, wallet_code, preferred_currency
 */
const getWallet = async (req, res, next) => {
  try {
    const wallet = await walletService.getWallet(req.user.id);
    res.json({ success: true, data: wallet });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /wallet/topup
 */
const topUp = [
  body('xaf_amount')
    .isInt({ min: 100 })
    .withMessage('xaf_amount must be an integer of at least 100'),
  body('payment_method')
    .isIn(VALID_PAYMENT_METHODS)
    .withMessage(`payment_method must be one of: ${VALID_PAYMENT_METHODS.join(', ')}`),
  body('phone')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('phone is required for mobile money methods'),
  validate,
  async (req, res, next) => {
    try {
      const { xaf_amount, payment_method, phone } = req.body;
      const result = await walletService.topUp({
        userId: req.user.id,
        xafAmount: xaf_amount,
        paymentMethod: payment_method,
        phone: phone || req.user.phone,
      });

      if (!result.success) {
        return res.status(400).json(result);
      }

      // Recalculate trust score — wallet balance affects score
      recalculateTrustScore(req.user.id).catch(() => {});
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
];

/**
 * POST /wallet/withdraw
 */
const withdraw = [
  body('tc_amount')
    .isFloat({ min: 0.01 })
    .withMessage('tc_amount must be at least 0.01'),
  body('destination').isObject().withMessage('destination must be an object'),
  body('destination.method')
    .isIn(VALID_PAYMENT_METHODS)
    .withMessage(`destination.method must be one of: ${VALID_PAYMENT_METHODS.join(', ')}`),
  validate,
  async (req, res, next) => {
    try {
      const { tc_amount, destination } = req.body;
      const result = await walletService.withdraw({
        userId: req.user.id,
        tcAmount: parseFloat(tc_amount),
        destination,
      });

      if (!result.success) {
        const status = result.code === 'DISBURSEMENT_FAILED' ? 500 : 400;
        return res.status(status).json(result);
      }

      res.json(result);
    } catch (error) {
      next(error);
    }
  },
];

/**
 * POST /wallet/transfer
 */
const transfer = [
  body('recipient_identifier')
    .trim()
    .notEmpty()
    .withMessage('recipient_identifier is required'),
  body('tc_amount')
    .isFloat({ min: 0.01 })
    .withMessage('tc_amount must be greater than 0'),
  validate,
  async (req, res, next) => {
    try {
      const { recipient_identifier, tc_amount } = req.body;
      const result = await walletService.transfer({
        senderId: req.user.id,
        recipientIdentifier: recipient_identifier,
        tcAmount: parseFloat(tc_amount),
      });

      if (!result.success) {
        const status = result.code === 'RECIPIENT_NOT_FOUND' ? 404 : 400;
        return res.status(status).json(result);
      }

      res.json(result);
    } catch (error) {
      next(error);
    }
  },
];

/**
 * GET /wallet/transfer/preview
 */
const getTransferPreview = [
  queryValidator('recipient_identifier')
    .trim()
    .notEmpty()
    .withMessage('recipient_identifier is required'),
  queryValidator('tc_amount')
    .isFloat({ min: 0.01 })
    .withMessage('tc_amount must be greater than 0'),
  validate,
  async (req, res, next) => {
    try {
      const { recipient_identifier, tc_amount } = req.query;
      const result = await walletService.getTransferPreview({
        senderId: req.user.id,
        recipientIdentifier: recipient_identifier,
        tcAmount: parseFloat(tc_amount),
      });

      if (!result.success) {
        const status = result.code === 'RECIPIENT_NOT_FOUND' ? 404 : 400;
        return res.status(status).json(result);
      }

      res.json(result);
    } catch (error) {
      next(error);
    }
  },
];

/**
 * GET /wallet/transactions
 */
const getTransactions = [
  queryValidator('type')
    .optional()
    .isIn(VALID_TX_TYPES)
    .withMessage(`type must be one of: ${VALID_TX_TYPES.join(', ')}`),
  queryValidator('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('limit must be between 1 and 50'),
  queryValidator('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('offset must be a non-negative integer'),
  validate,
  async (req, res, next) => {
    try {
      const { type, limit = 50, offset = 0 } = req.query;
      const result = await walletService.getTransactions({
        userId: req.user.id,
        type,
        limit: parseInt(limit),
        offset: parseInt(offset),
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  },
];

module.exports = { getWallet, topUp, withdraw, transfer, getTransferPreview, getTransactions };
