const { body, query: queryValidator, validationResult } = require('express-validator');
const { validate } = require('../middleware/validate');
const walletService = require('../services/walletService');
const { initiatePayLink, getPaymentStatus: fapshiGetStatus } = require('../services/paymentService');
const { recalculateTrustScore } = require('../services/trustScoreService');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

const TC_TO_XAF = 10000;
const VALID_PAYMENT_METHODS = ['mtn_momo', 'orange_money'];
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
 * Initiates a Fapshi Direct Pay request and returns transId immediately.
 * Frontend polls GET /wallet/payment-status/:transId to confirm.
 */
const topUp = [
  body('xaf_amount')
    .isInt({ min: 100 })
    .withMessage('xaf_amount must be an integer of at least 100'),
  body('payment_method')
    .isIn(VALID_PAYMENT_METHODS)
    .withMessage(`payment_method must be one of: ${VALID_PAYMENT_METHODS.join(', ')}`),
  validate,
  async (req, res, next) => {
    try {
      const { xaf_amount, payment_method } = req.body;

      // Initiate Fapshi payment link — returns link + transId immediately
      const { transId, link } = await initiatePayLink({
        amount:      xaf_amount,
        externalId:  `topup-${req.user.id}-${Date.now()}`,
        message:     'Via wallet top-up',
        userId:      req.user.id,
        redirectUrl: `${process.env.FRONTEND_URL || 'https://via-savings.up.railway.app'}/wallet`,
      });

      // Store pending top-up so we can credit wallet when confirmed
      await pool.query(
        `INSERT INTO wallet_transactions
         (user_id, type, tc_amount, xaf_amount, payment_method, external_tx_id, status)
         VALUES ($1, 'top_up', $2, $3, $4, $5, 'pending')`,
        [req.user.id, xaf_amount / TC_TO_XAF, xaf_amount, payment_method, transId]
      );

      res.json({
        success: true,
        message: 'Payment link generated. Complete payment to top up your wallet.',
        data: { transId, link, xaf_amount, tc_amount: xaf_amount / TC_TO_XAF },
      });
    } catch (error) {
      logger.error(`[TopUp] Error: ${error.message}`);
      // Return the actual error message so frontend can display it
      return res.status(400).json({ success: false, message: error.message || 'Payment initiation failed' });
    }
  },
];

/**
 * GET /wallet/payment-status/:transId
 * Polls Fapshi for payment status and credits wallet if SUCCESSFUL.
 */
const getPaymentStatus = async (req, res, next) => {
  try {
    const { transId } = req.params;

    // Find the pending transaction
    const txResult = await pool.query(
      `SELECT * FROM wallet_transactions WHERE external_tx_id = $1 AND user_id = $2`,
      [transId, req.user.id]
    );
    const tx = txResult.rows[0];
    if (!tx) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    // Already completed
    if (tx.status === 'completed') {
      return res.json({
        success: true,
        data: { status: 'SUCCESSFUL', tc_amount: parseFloat(tx.tc_amount), xaf_amount: parseFloat(tx.xaf_amount) },
      });
    }

    // Check with Fapshi
    const fapshiStatus = await fapshiGetStatus(transId);
    const { status } = fapshiStatus;

    if (status === 'SUCCESSFUL' && tx.status !== 'completed') {
      // Credit wallet
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          'UPDATE users SET tc_balance = tc_balance + $1 WHERE id = $2',
          [tx.tc_amount, req.user.id]
        );
        await client.query(
          `UPDATE wallet_transactions SET status = 'completed' WHERE external_tx_id = $1`,
          [transId]
        );
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      recalculateTrustScore(req.user.id).catch(() => {});

      const balanceResult = await pool.query('SELECT tc_balance FROM users WHERE id = $1', [req.user.id]);
      return res.json({
        success: true,
        data: {
          status:      'SUCCESSFUL',
          tc_amount:   parseFloat(tx.tc_amount),
          xaf_amount:  parseFloat(tx.xaf_amount),
          new_balance: parseFloat(balanceResult.rows[0].tc_balance),
        },
      });
    }

    if (status === 'FAILED' || status === 'EXPIRED') {
      await pool.query(
        `UPDATE wallet_transactions SET status = 'failed' WHERE external_tx_id = $1`,
        [transId]
      );
    }

    return res.json({ success: true, data: { status } });
  } catch (error) {
    next(error);
  }
};

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

module.exports = { getWallet, topUp, withdraw, transfer, getTransferPreview, getTransactions, getPaymentStatus };
