const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// Mock MTN MoMo payment
const initiateMTNMoMoPayment = async ({ phone, amount, reference, description }) => {
  logger.info(`[MTN MoMo] Initiating payment: ${amount} from ${phone}`);

  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 500));

  // Mock success (95% success rate for testing)
  const success = Math.random() > 0.05;

  if (success) {
    return {
      success: true,
      transactionId: `MTN-${uuidv4().substring(0, 8).toUpperCase()}`,
      status: 'SUCCESSFUL',
      amount,
      currency: 'XAF',
      message: 'Payment successful',
    };
  }

  return {
    success: false,
    status: 'FAILED',
    message: 'Payment failed. Please try again.',
  };
};

// Mock Orange Money payment
const initiateOrangeMoneyPayment = async ({ phone, amount, reference, description }) => {
  logger.info(`[Orange Money] Initiating payment: ${amount} from ${phone}`);

  await new Promise(resolve => setTimeout(resolve, 500));

  const success = Math.random() > 0.05;

  if (success) {
    return {
      success: true,
      transactionId: `OM-${uuidv4().substring(0, 8).toUpperCase()}`,
      status: 'SUCCESS',
      amount,
      currency: 'XAF',
      message: 'Payment successful',
    };
  }

  return {
    success: false,
    status: 'FAILED',
    message: 'Payment failed. Please try again.',
  };
};

const processPayment = async ({ method, phone, amount, reference, description }) => {
  switch (method) {
    case 'mtn_momo':
      return initiateMTNMoMoPayment({ phone, amount, reference, description });
    case 'orange_money':
      return initiateOrangeMoneyPayment({ phone, amount, reference, description });
    default:
      throw new Error(`Unsupported payment method: ${method}`);
  }
};

module.exports = { processPayment };
