const crypto = require('crypto');
const { pool } = require('../config/database');
const { processPayment } = require('./paymentService');
const { sendNotificationToUser } = require('./notificationService');
const exchangeRateService = require('./exchangeRateService');

const TC_TO_XAF = 10000; // 1 TC = 10,000 XAF (fixed)

// Withdrawal and transfer limits (verified users only)
const LIMITS = {
  SINGLE_MAX: 200, // TC
  DAILY_MAX: 500, // TC
  MONTHLY_MAX: 2000, // TC
};

/**
 * Initialize wallet for a new user
 * @param {string} userId
 * @param {object} client - optional DB client for use inside a transaction
 */
const initWallet = async (userId, client = null) => {
  const db = client || pool;
  // tc_balance defaults to 0.00000000 via migration, so no explicit insert needed
  // This is a no-op but kept for API consistency
  return { success: true };
};

/**
 * Get wallet info: balance, wallet_code, preferred_currency
 * @param {string} userId
 */
const getWallet = async (userId) => {
  const result = await pool.query(
    'SELECT tc_balance, wallet_code, preferred_currency FROM users WHERE id = $1',
    [userId]
  );
  
  if (!result.rows[0]) {
    throw new Error('User not found');
  }

  let { tc_balance, wallet_code, preferred_currency } = result.rows[0];

  // Generate wallet code if not yet activated
  if (!wallet_code) {
    wallet_code = await activateWalletCode(userId);
  }

  return {
    tc_balance: parseFloat(tc_balance),
    wallet_code,
    preferred_currency: preferred_currency || 'XAF',
  };
};

/**
 * Generate or return existing wallet_code
 * @param {string} userId
 */
const activateWalletCode = async (userId) => {
  // Check if already exists
  const existing = await pool.query('SELECT wallet_code FROM users WHERE id = $1', [userId]);
  if (existing.rows[0]?.wallet_code) {
    return existing.rows[0].wallet_code;
  }

  // Generate unique code: VIA-[A-Z0-9]{5}
  let code = null;
  let attempts = 0;
  const MAX_ATTEMPTS = 5;

  while (attempts < MAX_ATTEMPTS) {
    code = generateWalletCode();
    try {
      const result = await pool.query(
        'UPDATE users SET wallet_code = $1 WHERE id = $2 RETURNING wallet_code',
        [code, userId]
      );
      return result.rows[0].wallet_code;
    } catch (err) {
      if (err.code === '23505') { // unique violation
        attempts++;
        continue;
      }
      throw err;
    }
  }

  throw new Error('Failed to generate unique wallet code after maximum attempts');
};

/**
 * Generate a wallet code in format VIA-XXXXX
 */
const generateWalletCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.randomBytes(5);
  let code = 'VIA-';
  for (let i = 0; i < 5; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
};

/**
 * Check withdrawal/transfer limits
 * @param {object} params - { userId, tcAmount, isVerified }
 * @returns {object} { allowed, reason?, limitType?, currentTotal?, limit?, resetsAt? }
 */
const checkLimits = async ({ userId, tcAmount, isVerified }) => {
  // Require profile complete
  if (!isVerified) {
    return {
      allowed: false,
      reason: 'Identity verification required',
      limitType: 'profile_incomplete',
    };
  }

  // Single transaction max
  if (tcAmount > LIMITS.SINGLE_MAX) {
    return {
      allowed: false,
      reason: `Single transaction limit is ${LIMITS.SINGLE_MAX} TC`,
      limitType: 'single',
      limit: LIMITS.SINGLE_MAX,
    };
  }

  // Calculate rolling daily total (current calendar day UTC)
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setUTCHours(23, 59, 59, 999);

  const dailyResult = await pool.query(
    `SELECT COALESCE(SUM(tc_amount), 0) as total
     FROM wallet_transactions
     WHERE user_id = $1
       AND type IN ('withdrawal', 'transfer_out')
       AND status = 'completed'
       AND created_at >= $2
       AND created_at <= $3`,
    [userId, todayStart, todayEnd]
  );
  const dailyTotal = parseFloat(dailyResult.rows[0].total);

  if (dailyTotal + tcAmount > LIMITS.DAILY_MAX) {
    const tomorrowMidnight = new Date(todayStart);
    tomorrowMidnight.setUTCDate(tomorrowMidnight.getUTCDate() + 1);
    return {
      allowed: false,
      reason: `Daily limit of ${LIMITS.DAILY_MAX} TC would be exceeded`,
      limitType: 'daily',
      currentTotal: dailyTotal,
      limit: LIMITS.DAILY_MAX,
      resetsAt: tomorrowMidnight.toISOString(),
    };
  }

  // Calculate rolling monthly total (current calendar month UTC)
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const monthEnd = new Date(monthStart);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
  monthEnd.setUTCMilliseconds(-1);

  const monthlyResult = await pool.query(
    `SELECT COALESCE(SUM(tc_amount), 0) as total
     FROM wallet_transactions
     WHERE user_id = $1
       AND type IN ('withdrawal', 'transfer_out')
       AND status = 'completed'
       AND created_at >= $2
       AND created_at <= $3`,
    [userId, monthStart, monthEnd]
  );
  const monthlyTotal = parseFloat(monthlyResult.rows[0].total);

  if (monthlyTotal + tcAmount > LIMITS.MONTHLY_MAX) {
    const nextMonthStart = new Date(monthStart);
    nextMonthStart.setUTCMonth(nextMonthStart.getUTCMonth() + 1);
    return {
      allowed: false,
      reason: `Monthly limit of ${LIMITS.MONTHLY_MAX} TC would be exceeded`,
      limitType: 'monthly',
      currentTotal: monthlyTotal,
      limit: LIMITS.MONTHLY_MAX,
      resetsAt: nextMonthStart.toISOString(),
    };
  }

  return { allowed: true };
};

/**
 * Top-up: credit TC from fiat payment
 * @param {object} params - { userId, xafAmount, paymentMethod, phone }
 */
const topUp = async ({ userId, xafAmount, paymentMethod, phone }) => {
  // Validate minimum
  if (xafAmount < 100) {
    return {
      success: false,
      message: 'Minimum top-up amount is 100 XAF',
      code: 'AMOUNT_TOO_SMALL',
    };
  }

  const tcAmount = xafAmount / TC_TO_XAF;

  // Process payment first
  const payment = await processPayment({
    method: paymentMethod,
    phone,
    amount: xafAmount,
    reference: `topup-${userId}-${Date.now()}`,
    description: 'Via wallet top-up',
  });

  if (!payment.success) {
    return {
      success: false,
      message: payment.message || 'Payment failed',
      code: 'PAYMENT_FAILED',
    };
  }

  // Credit wallet in transaction
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      'UPDATE users SET tc_balance = tc_balance + $1 WHERE id = $2',
      [tcAmount, userId]
    );

    await client.query(
      `INSERT INTO wallet_transactions 
       (user_id, type, tc_amount, xaf_amount, payment_method, external_tx_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, 'top_up', tcAmount, xafAmount, paymentMethod, payment.transactionId, 'completed']
    );

    await client.query('COMMIT');

    const balanceResult = await pool.query('SELECT tc_balance FROM users WHERE id = $1', [userId]);

    return {
      success: true,
      message: 'Top-up successful',
      data: {
        tc_amount: tcAmount,
        xaf_amount: xafAmount,
        new_balance: parseFloat(balanceResult.rows[0].tc_balance),
        transaction_id: payment.transactionId,
      },
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Withdrawal: debit TC, disburse fiat
 * @param {object} params - { userId, tcAmount, destination }
 * destination: { method, phone?, accountDetails?, cardDetails? }
 */
const withdraw = async ({ userId, tcAmount, destination }) => {
  // Validate minimum
  if (tcAmount < 0.01) {
    return {
      success: false,
      message: 'Minimum withdrawal amount is 0.01 TC',
      code: 'AMOUNT_TOO_SMALL',
    };
  }

  // Check user verification status
  const userResult = await pool.query('SELECT profile_complete FROM users WHERE id = $1', [userId]);
  const isVerified = userResult.rows[0]?.profile_complete || false;

  // Check limits
  const limitCheck = await checkLimits({ userId, tcAmount, isVerified });
  if (!limitCheck.allowed) {
    return {
      success: false,
      message: limitCheck.reason,
      code: 'LIMIT_EXCEEDED',
      limitType: limitCheck.limitType,
      currentTotal: limitCheck.currentTotal,
      limit: limitCheck.limit,
      resetsAt: limitCheck.resetsAt,
    };
  }

  const xafAmount = tcAmount * TC_TO_XAF;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock and check balance
    const balanceResult = await client.query(
      'SELECT tc_balance FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );
    const currentBalance = parseFloat(balanceResult.rows[0].tc_balance);

    if (currentBalance < tcAmount) {
      await client.query('ROLLBACK');
      return {
        success: false,
        message: 'Insufficient balance',
        code: 'INSUFFICIENT_BALANCE',
      };
    }

    // Deduct balance
    await client.query(
      'UPDATE users SET tc_balance = tc_balance - $1 WHERE id = $2',
      [tcAmount, userId]
    );

    // Insert pending transaction
    const txResult = await client.query(
      `INSERT INTO wallet_transactions 
       (user_id, type, tc_amount, xaf_amount, payment_method, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [userId, 'withdrawal', tcAmount, xafAmount, destination.method, 'pending']
    );
    const txId = txResult.rows[0].id;

    // Attempt disbursement
    try {
      const disbursement = await processPayment({
        method: destination.method,
        phone: destination.phone,
        amount: xafAmount,
        reference: `withdrawal-${txId}`,
        description: 'Via wallet withdrawal',
      });

      if (disbursement.success) {
        // Mark completed
        await client.query(
          'UPDATE wallet_transactions SET status = $1, external_tx_id = $2 WHERE id = $3',
          ['completed', disbursement.transactionId, txId]
        );
        await client.query('COMMIT');

        return {
          success: true,
          message: 'Withdrawal successful',
          data: {
            tc_amount: tcAmount,
            xaf_amount: xafAmount,
            transaction_id: disbursement.transactionId,
          },
        };
      } else {
        // Disbursement failed — reverse
        await client.query(
          'UPDATE users SET tc_balance = tc_balance + $1 WHERE id = $2',
          [tcAmount, userId]
        );
        await client.query(
          'UPDATE wallet_transactions SET status = $1 WHERE id = $2',
          ['reversed', txId]
        );
        // Insert compensating credit
        await client.query(
          `INSERT INTO wallet_transactions 
           (user_id, type, tc_amount, xaf_amount, status)
           VALUES ($1, $2, $3, $4, $5)`,
          [userId, 'top_up', tcAmount, xafAmount, 'completed']
        );
        await client.query('COMMIT');

        return {
          success: false,
          message: disbursement.message || 'Disbursement failed',
          code: 'DISBURSEMENT_FAILED',
        };
      }
    } catch (disbursementError) {
      // Reverse on exception
      await client.query(
        'UPDATE users SET tc_balance = tc_balance + $1 WHERE id = $2',
        [tcAmount, userId]
      );
      await client.query(
        'UPDATE wallet_transactions SET status = $1 WHERE id = $2',
        ['reversed', txId]
      );
      await client.query(
        `INSERT INTO wallet_transactions 
         (user_id, type, tc_amount, xaf_amount, status)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, 'top_up', tcAmount, xafAmount, 'completed']
      );
      await client.query('COMMIT');

      return {
        success: false,
        message: 'Disbursement failed',
        code: 'DISBURSEMENT_FAILED',
      };
    }
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Contribution via wallet (called by contributionController)
 * @param {object} params - { userId, groupId, cycleNumber, tcAmount }
 */
const payContribution = async ({ userId, groupId, cycleNumber, tcAmount }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock and check balance
    const balanceResult = await client.query(
      'SELECT tc_balance FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );
    const currentBalance = parseFloat(balanceResult.rows[0].tc_balance);

    if (currentBalance < tcAmount) {
      await client.query('ROLLBACK');
      return {
        success: false,
        message: 'Insufficient TC balance',
        code: 'INSUFFICIENT_BALANCE',
      };
    }

    // Deduct balance
    await client.query(
      'UPDATE users SET tc_balance = tc_balance - $1 WHERE id = $2',
      [tcAmount, userId]
    );

    // Insert transaction
    await client.query(
      `INSERT INTO wallet_transactions 
       (user_id, type, tc_amount, xaf_amount, fee_tc, payment_method, group_id, cycle_number, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [userId, 'contribution', tcAmount, tcAmount * TC_TO_XAF, 0, 'tc_wallet', groupId, cycleNumber, 'completed']
    );

    await client.query('COMMIT');

    const newBalanceResult = await pool.query('SELECT tc_balance FROM users WHERE id = $1', [userId]);

    return {
      success: true,
      message: 'Contribution paid from wallet',
      data: {
        tc_amount: tcAmount,
        new_balance: parseFloat(newBalanceResult.rows[0].tc_balance),
      },
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Credit payout into wallet (called by payoutQueueService)
 * @param {object} params - { userId, groupId, payoutId, xafAmount }
 */
const creditPayout = async ({ userId, groupId, payoutId, xafAmount }) => {
  const tcAmount = xafAmount / TC_TO_XAF;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      'UPDATE users SET tc_balance = tc_balance + $1 WHERE id = $2',
      [tcAmount, userId]
    );

    await client.query(
      `INSERT INTO wallet_transactions 
       (user_id, type, tc_amount, xaf_amount, fee_tc, payment_method, group_id, payout_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [userId, 'payout', tcAmount, xafAmount, 0, 'tc_wallet', groupId, payoutId, 'completed']
    );

    await client.query('COMMIT');

    // Send notification
    await sendNotificationToUser({
      userId,
      title: 'Payout Received',
      message: `You received ${tcAmount.toFixed(2)} TC (${xafAmount.toFixed(0)} XAF) from your group payout`,
      type: 'payout',
      groupId,
    });

    return {
      success: true,
      tc_amount: tcAmount,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Transfer preview (fee calculation + fiat equivalents)
 * @param {object} params - { senderId, recipientIdentifier, tcAmount }
 */
const getTransferPreview = async ({ senderId, recipientIdentifier, tcAmount }) => {
  // Resolve recipient
  const recipient = await resolveRecipient(recipientIdentifier);
  if (!recipient) {
    return {
      success: false,
      message: 'Recipient not found',
      code: 'RECIPIENT_NOT_FOUND',
    };
  }

  // Check if sender and recipient share a common active group
  const sharedGroupResult = await pool.query(
    `SELECT COUNT(*) as count FROM members m1
     JOIN members m2 ON m1.group_id = m2.group_id
     JOIN groups g ON m1.group_id = g.id
     WHERE m1.user_id = $1 AND m2.user_id = $2
       AND m1.status = 'approved' AND m2.status = 'approved'
       AND g.status = 'active'`,
    [senderId, recipient.id]
  );
  const hasSharedGroup = parseInt(sharedGroupResult.rows[0].count) > 0;

  // Calculate fee
  const fee = hasSharedGroup ? 0 : Math.ceil(tcAmount * 0.005 * 100) / 100;
  const totalDeducted = tcAmount + fee;

  // Get fiat equivalents
  const amountFiat = await exchangeRateService.convertTC(tcAmount);
  const feeFiat = await exchangeRateService.convertTC(fee);
  const totalFiat = await exchangeRateService.convertTC(totalDeducted);

  return {
    success: true,
    data: {
      recipient_name: recipient.name,
      recipient_id: recipient.id,
      tc_amount: tcAmount,
      fee_tc: fee,
      total_tc: totalDeducted,
      amount_fiat: amountFiat,
      fee_fiat: feeFiat,
      total_fiat: totalFiat,
      has_shared_group: hasSharedGroup,
    },
  };
};

/**
 * Peer-to-peer transfer
 * @param {object} params - { senderId, recipientIdentifier, tcAmount }
 */
const transfer = async ({ senderId, recipientIdentifier, tcAmount }) => {
  // Resolve recipient
  const recipient = await resolveRecipient(recipientIdentifier);
  if (!recipient) {
    return {
      success: false,
      message: 'Recipient not found',
      code: 'RECIPIENT_NOT_FOUND',
    };
  }

  // Check sender verification
  const senderResult = await pool.query('SELECT profile_complete, name FROM users WHERE id = $1', [senderId]);
  const isVerified = senderResult.rows[0]?.profile_complete || false;
  const senderName = senderResult.rows[0]?.name || 'Unknown';

  // Check limits
  const limitCheck = await checkLimits({ userId: senderId, tcAmount, isVerified });
  if (!limitCheck.allowed) {
    return {
      success: false,
      message: limitCheck.reason,
      code: 'LIMIT_EXCEEDED',
      limitType: limitCheck.limitType,
      currentTotal: limitCheck.currentTotal,
      limit: limitCheck.limit,
      resetsAt: limitCheck.resetsAt,
    };
  }

  // Check shared group for fee
  const sharedGroupResult = await pool.query(
    `SELECT COUNT(*) as count FROM members m1
     JOIN members m2 ON m1.group_id = m2.group_id
     JOIN groups g ON m1.group_id = g.id
     WHERE m1.user_id = $1 AND m2.user_id = $2
       AND m1.status = 'approved' AND m2.status = 'approved'
       AND g.status = 'active'`,
    [senderId, recipient.id]
  );
  const hasSharedGroup = parseInt(sharedGroupResult.rows[0].count) > 0;

  const fee = hasSharedGroup ? 0 : Math.ceil(tcAmount * 0.005 * 100) / 100;
  const totalDeducted = tcAmount + fee;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock sender balance
    const senderBalanceResult = await client.query(
      'SELECT tc_balance FROM users WHERE id = $1 FOR UPDATE',
      [senderId]
    );
    const senderBalance = parseFloat(senderBalanceResult.rows[0].tc_balance);

    if (senderBalance < totalDeducted) {
      await client.query('ROLLBACK');
      return {
        success: false,
        message: 'Insufficient balance to cover transfer and fee',
        code: 'INSUFFICIENT_BALANCE',
      };
    }

    // Lock recipient balance
    await client.query(
      'SELECT tc_balance FROM users WHERE id = $1 FOR UPDATE',
      [recipient.id]
    );

    // Deduct from sender
    await client.query(
      'UPDATE users SET tc_balance = tc_balance - $1 WHERE id = $2',
      [totalDeducted, senderId]
    );

    // Credit recipient
    await client.query(
      'UPDATE users SET tc_balance = tc_balance + $1 WHERE id = $2',
      [tcAmount, recipient.id]
    );

    // Insert sender transaction
    await client.query(
      `INSERT INTO wallet_transactions 
       (user_id, type, tc_amount, xaf_amount, fee_tc, counterparty_user_id, counterparty_name, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [senderId, 'transfer_out', tcAmount, tcAmount * TC_TO_XAF, fee, recipient.id, recipient.name, 'completed']
    );

    // Insert recipient transaction
    await client.query(
      `INSERT INTO wallet_transactions 
       (user_id, type, tc_amount, xaf_amount, fee_tc, counterparty_user_id, counterparty_name, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [recipient.id, 'transfer_in', tcAmount, tcAmount * TC_TO_XAF, 0, senderId, senderName, 'completed']
    );

    await client.query('COMMIT');

    // Send notification to recipient
    await sendNotificationToUser({
      userId: recipient.id,
      title: 'Transfer Received',
      message: `${senderName} sent you ${tcAmount.toFixed(2)} TC`,
      type: 'transfer',
    });

    return {
      success: true,
      message: 'Transfer successful',
      data: {
        tc_amount: tcAmount,
        fee_tc: fee,
        total_deducted: totalDeducted,
        recipient_name: recipient.name,
      },
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Get transaction history (paginated)
 * @param {object} params - { userId, type?, limit, offset }
 */
const getTransactions = async ({ userId, type, limit = 50, offset = 0 }) => {
  let query = `
    SELECT id, type, tc_amount, xaf_amount, fee_tc, payment_method, 
           counterparty_name, group_id, status, created_at
    FROM wallet_transactions
    WHERE user_id = $1
  `;
  const params = [userId];

  if (type) {
    query += ` AND type = $${params.length + 1}`;
    params.push(type);
  }

  query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(Math.min(limit, 50), offset);

  const result = await pool.query(query, params);

  // Get total count
  let countQuery = 'SELECT COUNT(*) as total FROM wallet_transactions WHERE user_id = $1';
  const countParams = [userId];
  if (type) {
    countQuery += ' AND type = $2';
    countParams.push(type);
  }
  const countResult = await pool.query(countQuery, countParams);

  return {
    success: true,
    data: {
      transactions: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit,
      offset,
    },
  };
};

/**
 * Resolve recipient by phone or wallet_code
 * @param {string} identifier - phone number or wallet code
 * @returns {object|null} - { id, name } or null
 */
const resolveRecipient = async (identifier) => {
  // Try wallet code first
  let result = await pool.query(
    'SELECT id, name FROM users WHERE wallet_code = $1 AND is_active = true',
    [identifier]
  );

  if (result.rows[0]) {
    return result.rows[0];
  }

  // Try phone
  result = await pool.query(
    'SELECT id, name FROM users WHERE phone = $1 AND is_active = true',
    [identifier]
  );

  return result.rows[0] || null;
};

/**
 * Credit a member's wallet with their share of a penalty pool distribution.
 */
const creditPenaltyShare = async ({ userId, groupId, xafAmount }) => {
  const tcAmount = xafAmount / TC_TO_XAF;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'UPDATE users SET tc_balance = tc_balance + $1 WHERE id = $2',
      [tcAmount, userId]
    );
    await client.query(
      `INSERT INTO wallet_transactions
       (user_id, type, tc_amount, xaf_amount, fee_tc, payment_method, group_id, status)
       VALUES ($1, 'payout', $2, $3, 0, 'tc_wallet', $4, 'completed')`,
      [userId, tcAmount, xafAmount, groupId]
    );
    await client.query('COMMIT');
    return { success: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  initWallet,
  getWallet,
  activateWalletCode,
  checkLimits,
  topUp,
  withdraw,
  payContribution,
  creditPayout,
  creditPenaltyShare,
  getTransferPreview,
  transfer,
  getTransactions,
};
