import api from './client';
export const getAdminStats    = ()       => api.get('/admin/stats');
export const getAdminUsers    = ()       => api.get('/admin/users');
export const getAdminLocations = ()      => api.get('/admin/locations');
export const updateAdminUser  = (id, data) => api.patch(`/admin/users/${id}`, data);
