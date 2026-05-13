import api from './client';
export const getContributionReceipt = (id) => api.get(`/receipts/contribution/${id}`);
export const getPayoutReceipt = (id) => api.get(`/receipts/payout/${id}`);
export const getTransactionReceipt = (id) => api.get(`/receipts/transaction/${id}`);
export const getSavingsReceipt = (id) => api.get(`/receipts/savings/${id}`);
export const getSavingsWithdrawalReceipt = (id) => api.get(`/receipts/savings-withdrawal/${id}`);
export const getReceiptHistory = () => api.get('/receipts/history');
