import api from './client';
export const getGroups = () => api.get('/groups');
export const getGroup = (id) => api.get(`/groups/${id}`);
export const createGroup = (data) => api.post('/groups', data);
export const updateGroup = (id, data) => api.patch(`/groups/${id}`, data);
export const joinGroup = (id, data) => api.post(`/groups/${id}/join`, data);
export const startGroup = (id) => api.post(`/groups/${id}/start`);
export const startNextCircle = (id, data) => api.post(`/groups/${id}/start-next-circle`, data);
export const reconfirmMembership = (id) => api.post(`/groups/${id}/reconfirm`);
export const forfeitMembership = (id) => api.post(`/groups/${id}/forfeit`);
export const approveMember = (gId, uId) => api.patch(`/groups/${gId}/members/${uId}/approve`);
export const rejectMember  = (gId, uId) => api.patch(`/groups/${gId}/members/${uId}/reject`);
export const getPayouts = (id) => api.get(`/groups/${id}/payouts`);
export const processPayout = (groupId, payoutId) => api.post(`/groups/${groupId}/payouts/${payoutId}/process`);
export const contribute = (id, data) => api.post(`/groups/${id}/contribute`, data);
export const getContributions = (id) => api.get(`/groups/${id}/contributions`);
export const getInviteLink = (id) => api.get(`/groups/${id}/invite`);
export const getContributionInfo = (id) => api.get(`/groups/${id}/contribution-info`);
export const getGroupPool = (id) => api.get(`/groups/${id}/pool`);
export const payInstallment = (id, data) => api.post(`/groups/${id}/installment`, data);
export const requestEarlyPayout = (id, data) => api.post(`/groups/${id}/early-payout`, data);
export const toggleAutopay = (id, data) => api.post(`/groups/${id}/autopay`, data);
export const joinByInvite = (token) => api.post(`/groups/join-by-invite/${token}`);
export const submitAdminRequest = (groupId) =>
  api.post(`/groups/${groupId}/admin-requests`);

export const voteOnAdminRequest = (groupId, requestId, data) =>
  api.post(`/groups/${groupId}/admin-requests/${requestId}/vote`, data);

export const getAdminRequests = (groupId) =>
  api.get(`/groups/${groupId}/admin-requests`);

export const getMyAdminRequest = (groupId) =>
  api.get(`/groups/${groupId}/admin-requests/my`);

// ── Flexible contribution group API ───────────────────────────────────────
export const createFlexibleGroup      = (data)                    => api.post('/groups/flexible', data);
export const updateFlexibleSettings   = (id, data)                => api.patch(`/groups/${id}/flexible-settings`, data);
export const activateFlexibleGroup    = (id)                      => api.post(`/groups/${id}/activate`);
export const closeFlexibleGroup       = (id)                      => api.post(`/groups/${id}/close`);
export const deleteFlexibleGroup      = (id)                      => api.delete(`/groups/${id}/flexible`, { data: { confirm: true } });
export const leaveFlexibleGroup       = (id)                      => api.post(`/groups/${id}/flexible-leave`);

export const contributeFlexible       = (id, data)                => api.post(`/groups/${id}/flexible-contributions`, data);
export const getFlexibleContributions = (id)                      => api.get(`/groups/${id}/flexible-contributions`);
export const getFlexiblePoolSummary   = (id)                      => api.get(`/groups/${id}/flexible-pool`);

export const createDisbursement       = (id, data)                => api.post(`/groups/${id}/flexible-disbursements`, data);
export const getDisbursements         = (id)                      => api.get(`/groups/${id}/flexible-disbursements`);
export const updateDisbursement       = (id, disbId, data)        => api.patch(`/groups/${id}/flexible-disbursements/${disbId}`, data);
