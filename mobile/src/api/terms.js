import api from './client';
export const checkTerms = (type, groupId) => api.get(`/terms/check?type=${type}${groupId ? `&group_id=${groupId}` : ''}`);
export const acceptTerms = (type, reminderFrequency, groupId) => api.post('/terms/accept', { type, reminder_frequency: reminderFrequency, group_id: groupId });
