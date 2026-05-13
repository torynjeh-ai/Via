import api from './client';
export const getSavingsGoals  = ()           => api.get('/savings');
export const getSavingsGoal   = (id)         => api.get(`/savings/${id}`);
export const createSavingsGoal = (data)      => api.post('/savings', data);
export const updateSavingsGoal = (id, data)  => api.patch(`/savings/${id}`, data);
export const depositToGoal    = (id, data)   => api.post(`/savings/${id}/deposit`, data);
export const withdrawFromGoal = (id, data) => api.post(`/savings/${id}/withdraw`, data);
export const deleteSavingsGoal = (id)        => api.delete(`/savings/${id}`);
