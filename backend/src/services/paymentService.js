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
 * Initiate Pay — generates a Fapshi-hosted payment link.
 * User opens the link to complete payment via MTN/Orange on Fapshi's page.
 *
 * @returns {{ transId, link, dateInitiated }}
 */
const initiatePayLink = async ({ amount, externalId, message, userId, redirectUrl }) => {
  if (!FAPSHI_API_USER || !FAPSHI_API_KEY) {
    throw new Error('Fapshi credentials not configured (FAPSHI_API_USER / FAPSHI_API_KEY)');
  }

  const safeExternalId = (externalId || '').replace(/[^a-zA-Z0-9\-_]/g, '-').substring(0, 100);
  const safeUserId     = (userId     || '').replace(/[^a-zA-Z0-9\-_]/g, '-').substring(0, 100);

  const body = {
    amount:     Math.round(amount),
    externalId: safeExternalId,
    message:    message || 'Via payment',
    userId:     safeUserId,
    ...(redirectUrl ? { redirectUrl } : {}),
  };

  logger.info(`[Fapshi] Initiating pay link: ${amount} XAF`);

  const response = await fetch(`${FAPSHI_BASE_URL}/initiate-pay`, {
    method:  'POST',
    headers: fapshiHeaders(),
    body:    JSON.stringify(body),
    signal:  AbortSignal.timeout(30000),
  });

  const data = await response.json();

  if (!response.ok) {
    logger.error(`[Fapshi] Initiate pay failed: ${JSON.stringify(data)}`);
    throw new Error(data.message || `Fapshi error ${response.status}`);
  }

  logger.info(`[Fapshi] Pay link created: transId=${data.transId}`);
  return { transId: data.transId, link: data.link, dateInitiated: data.dateInitiated };
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

module.exports = { initiatePayLink, getPaymentStatus };
