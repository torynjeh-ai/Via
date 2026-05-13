const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

const initiateMTNMoMoPayment = async ({ phone, amount, reference, description }) => {
  logger.info(`[MTN MoMo] Initiating payment: ${amount} from ${phone}`);
  await new Promise(resolve => setTimeout(resolve, 500));
  const success = Math.random() > 0.05;
  if (success) {
    return { success: true, transactionId: `MTN-${uuidv4().substring(0, 8).toUpperCase()}`, status: 'SUCCESSFUL', amount, currency: 'XAF', message: 'Payment successful' };
  }
  return { success: false, status: 'FAILED', message: 'Payment failed. Please try again.' };
};

const initiateOrangeMoneyPayment = async ({ phone, amount, reference, description }) => {
  logger.info(`[Orange Money] Initiating payment: ${amount} from ${phone}`);
  await new Promise(resolve => setTimeout(resolve, 500));
  const success = Math.random() > 0.05;
  if (success) {
    return { success: true, transactionId: `OM-${uuidv4().substring(0, 8).toUpperCase()}`, status: 'SUCCESS', amount, currency: 'XAF', message: 'Payment successful' };
  }
  return { success: false, status: 'FAILED', message: 'Payment failed. Please try again.' };
};

const initiateApplePayPayment = async ({ amount, reference, description }) => {
  logger.info(`[Apple Pay] Initiating payment: ${amount}`);
  await new Promise(resolve => setTimeout(resolve, 400));
  const success = Math.random() > 0.05;
  if (success) {
    return { success: true, transactionId: `AP-${uuidv4().substring(0, 8).toUpperCase()}`, status: 'COMPLETED', amount, currency: 'XAF', message: 'Apple Pay payment successful' };
  }
  return { success: false, status: 'FAILED', message: 'Apple Pay payment failed. Please try again.' };
};

const initiatePayPalPayment = async ({ amount, reference, description }) => {
  logger.info(`[PayPal] Initiating payment: ${amount}`);
  await new Promise(resolve => setTimeout(resolve, 600));
  const success = Math.random() > 0.05;
  if (success) {
    return { success: true, transactionId: `PP-${uuidv4().substring(0, 8).toUpperCase()}`, status: 'COMPLETED', amount, currency: 'XAF', message: 'PayPal payment successful' };
  }
  return { success: false, status: 'FAILED', message: 'PayPal payment failed. Please try again.' };
};

const processPayment = async ({ method, phone, amount, reference, description }) => {
  switch (method) {
    case 'mtn_momo':    return initiateMTNMoMoPayment({ phone, amount, reference, description });
    case 'orange_money':return initiateOrangeMoneyPayment({ phone, amount, reference, description });
    case 'apple_pay':   return initiateApplePayPayment({ amount, reference, description });
    case 'paypal':      return initiatePayPalPayment({ amount, reference, description });
    default: throw new Error(`Unsupported payment method: ${method}`);
  }
};

module.exports = { processPayment };
