import api from './client';
export const getContributionReceipt = (id) => api.get(`/receipts/contribution/${id}`);
export const getPayoutReceipt = (id) => api.get(`/receipts/payout/${id}`);
export const getReceiptHistory = () => api.get('/receipts/history');
