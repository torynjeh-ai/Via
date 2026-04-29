import api from './client';

export const getGroups = () => api.get('/groups');
export const getGroup = (id) => api.get(`/groups/${id}`);
export const createGroup = (data) => api.post('/groups', data);
export const updateGroup = (id, data) => api.patch(`/groups/${id}`, data);
export const joinGroup = (id, data) => api.post(`/groups/${id}/join`, data);
export const startGroup = (id) => api.post(`/groups/${id}/start`);
export const endCircle = (id, data) => api.post(`/groups/${id}/end-circle`, data);
export const startNextCircle = (id, data) => api.post(`/groups/${id}/start-next-circle`, data);
export const reconfirmMembership = (id) => api.post(`/groups/${id}/reconfirm`);
export const forfeitMembership = (id) => api.post(`/groups/${id}/forfeit`);
export const approveMember = (groupId, userId) => api.patch(`/groups/${groupId}/members/${userId}/approve`);
export const getPayouts = (id) => api.get(`/groups/${id}/payouts`);
export const contribute = (id, data) => api.post(`/groups/${id}/contribute`, data);
export const getContributions = (id) => api.get(`/groups/${id}/contributions`);
