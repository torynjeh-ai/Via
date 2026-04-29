import api from './client';

export const getWallet = () => api.get('/wallet');
export const topUp = (data) => api.post('/wallet/topup', data);
export const withdraw = (data) => api.post('/wallet/withdraw', data);
export const transfer = (data) => api.post('/wallet/transfer', data);
export const getTransferPreview = (params) => api.get('/wallet/transfer/preview', { params });
export const getTransactions = (params) => api.get('/wallet/transactions', { params });
