const logger = require('../utils/logger');

const FAPSHI_BASE_URL = 'https://live.fapshi.com';
const FAPSHI_API_USER = process.env.FAPSHI_API_USER;
const FAPSHI_API_KEY  = process.env.FAPSHI_API_KEY;

const fapshiHeaders = () => ({
  'Content-Type': 'application/json',
  'apiuser': FAPSHI_API_USER,
  'apikey':  FAPSHI_API_KEY,
});

/**
 * Initiate a Direct Pay request via Fapshi.
 * Sends a payment prompt to the user's MTN/Orange phone.
 *
 * @param {object} params
 * @param {number} params.amount      - Amount in XAF (integer, min 100)
 * @param {string} params.phone       - Phone number e.g. "677123456" or "+237677123456"
 * @param {string} params.externalId  - Your internal reference (alphanumeric + - _)
 * @param {string} params.message     - Payment description shown to user
 * @param {string} params.userId      - Your internal user ID
 * @param {string} params.name        - Payer name (optional)
 * @returns {{ transId: string }}
 */
const initiateDirectPay = async ({ amount, phone, externalId, message, userId, name }) => {
  if (!FAPSHI_API_USER || !FAPSHI_API_KEY) {
    throw new Error('Fapshi credentials not configured (FAPSHI_API_USER / FAPSHI_API_KEY)');
  }

  // Fapshi expects phone without country code prefix for Cameroon numbers
  // e.g. "677123456" not "+237677123456"
  const cleanPhone = phone.replace(/^\+?237/, '').replace(/\s+/g, '');

  // externalId must be alphanumeric + - _ only, max 100 chars
  const safeExternalId = (externalId || '').replace(/[^a-zA-Z0-9\-_]/g, '-').substring(0, 100);

  const body = {
    amount:     Math.round(amount),
    phone:      cleanPhone,
    externalId: safeExternalId,
    message:    message || 'Via payment',
    userId:     (userId || '').substring(0, 100),
    ...(name ? { name } : {}),
  };

  logger.info(`[Fapshi] Initiating direct pay: ${amount} XAF to ${cleanPhone}`);

  const response = await fetch(`${FAPSHI_BASE_URL}/direct-pay`, {
    method:  'POST',
    headers: fapshiHeaders(),
    body:    JSON.stringify(body),
    signal:  AbortSignal.timeout(30000),
  });

  const data = await response.json();

  if (!response.ok) {
    logger.error(`[Fapshi] Direct pay failed: ${JSON.stringify(data)}`);
    throw new Error(data.message || `Fapshi error ${response.status}`);
  }

  logger.info(`[Fapshi] Payment initiated: transId=${data.transId}`);
  return { transId: data.transId, dateInitiated: data.dateInitiated };
};

/**
 * Poll Fapshi for payment status.
 * Rate limit: max 6 requests per minute per transId.
 *
 * @param {string} transId
 * @returns {{ status: 'CREATED'|'PENDING'|'SUCCESSFUL'|'FAILED'|'EXPIRED', amount: number }}
 */
const getPaymentStatus = async (transId) => {
  if (!FAPSHI_API_USER || !FAPSHI_API_KEY) {
    throw new Error('Fapshi credentials not configured');
  }

  const response = await fetch(`${FAPSHI_BASE_URL}/payment-status/${transId}`, {
    method:  'GET',
    headers: fapshiHeaders(),
    signal:  AbortSignal.timeout(15000),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || `Fapshi status check error ${response.status}`);
  }

  return data;
};

/**
 * Initiate payment and poll until SUCCESSFUL or FAILED/EXPIRED.
 * Polls every 10 seconds for up to 2 minutes (12 attempts, well within 6/min limit).
 *
 * @param {object} params - same as initiateDirectPay
 * @returns {{ success: boolean, transactionId: string, message: string }}
 */
const processPayment = async ({ method, phone, amount, reference, description, userId, name }) => {
  // Only MTN MoMo and Orange Money go through Fapshi
  if (method !== 'mtn_momo' && method !== 'orange_money') {
    throw new Error(`Payment method "${method}" is not supported. Use mtn_momo or orange_money.`);
  }

  if (!phone) {
    throw new Error('Phone number is required for mobile money payments');
  }

  // Initiate the payment
  const { transId } = await initiateDirectPay({
    amount,
    phone,
    externalId: reference,
    message:    description,
    userId:     userId || '',
    name:       name   || '',
  });

  // Poll for status — every 10s, up to 2 minutes (12 polls)
  const MAX_POLLS    = 12;
  const POLL_INTERVAL_MS = 10000;

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

    let statusData;
    try {
      statusData = await getPaymentStatus(transId);
    } catch (err) {
      logger.warn(`[Fapshi] Status poll ${i + 1} failed: ${err.message}`);
      continue;
    }

    const { status } = statusData;
    logger.info(`[Fapshi] Poll ${i + 1}/${MAX_POLLS}: transId=${transId} status=${status}`);

    if (status === 'SUCCESSFUL') {
      return {
        success:       true,
        transactionId: transId,
        message:       'Payment successful',
      };
    }

    if (status === 'FAILED' || status === 'EXPIRED') {
      return {
        success: false,
        transactionId: transId,
        message: status === 'FAILED' ? 'Payment was declined or failed' : 'Payment request expired',
      };
    }

    // CREATED or PENDING — keep polling
  }

  // Timed out — payment still pending
  return {
    success:       false,
    transactionId: transId,
    message:       'Payment timed out. Please check your phone and try again.',
  };
};

module.exports = { processPayment, initiateDirectPay, getPaymentStatus };
