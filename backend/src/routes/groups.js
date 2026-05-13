const { Router } = require('express');
const { authenticate, requireGroupAdmin, requireProfileComplete } = require('../middleware/auth');
const { createGroup, getGroups, getGroup, joinGroup, approveMember, rejectMember, startGroup, updateGroup, getPayouts, processPayout, getInviteLink, joinByInvite, reconfirmMembership, forfeitMembership, startNextCircle } = require('../controllers/groupController');
const { contribute, getContributions, getContributionInfo } = require('../controllers/contributionController');
const { getGroupPool, payInstallment, requestEarlyPayout, toggleAutopay } = require('../controllers/installmentController');
const { submitAdminRequest, voteOnAdminRequest, getAdminRequests, getMyAdminRequest } = require('../controllers/adminRequestController');
const {
  createFlexibleGroup, updateFlexibleGroupSettings, activateFlexibleGroup,
  closeFlexibleGroup, deleteFlexibleGroup, leaveFlexibleGroup,
  contributeFlexible, getFlexiblePoolSummary, getFlexibleContributions,
  createDisbursement, getDisbursements, updateDisbursement,
} = require('../controllers/flexibleGroupController');

const router = Router();

router.use(authenticate);

// Read-only routes — no profile required
router.get('/', getGroups);
router.get('/:id', getGroup);
router.get('/:id/payouts', getPayouts);
router.get('/:id/contributions', getContributions);
router.get('/:id/contribution-info', getContributionInfo);
router.get('/:id/pool', getGroupPool);
router.get('/:id/invite', getInviteLink);

// Join via invite link
router.post('/join-by-invite/:token', requireProfileComplete, joinByInvite);

// Write routes — profile must be complete
router.post('/', requireProfileComplete, createGroup);
router.post('/:id/join', requireProfileComplete, joinGroup);
router.post('/:id/start', requireProfileComplete, requireGroupAdmin, startGroup);
router.post('/:id/payouts/:payoutId/process', requireProfileComplete, requireGroupAdmin, processPayout);
router.post('/:id/start-next-circle', requireProfileComplete, requireGroupAdmin, startNextCircle);
router.post('/:id/reconfirm', requireProfileComplete, reconfirmMembership);
router.post('/:id/forfeit', requireProfileComplete, forfeitMembership);
router.post('/:id/contribute', requireProfileComplete, contribute);
router.post('/:id/installment', requireProfileComplete, payInstallment);
router.post('/:id/early-payout', requireProfileComplete, requestEarlyPayout);
router.post('/:id/autopay', requireProfileComplete, toggleAutopay);
router.patch('/:id', requireProfileComplete, requireGroupAdmin, updateGroup);
router.patch('/:id/members/:userId/approve', requireProfileComplete, requireGroupAdmin, approveMember);
router.patch('/:id/members/:userId/reject', requireProfileComplete, requireGroupAdmin, rejectMember);

router.post('/:id/admin-requests', requireProfileComplete, submitAdminRequest);
router.post('/:id/admin-requests/:requestId/vote', requireProfileComplete, voteOnAdminRequest);
router.get('/:id/admin-requests', getAdminRequests);
router.get('/:id/admin-requests/my', getMyAdminRequest);

// ── Flexible group routes ──────────────────────────────────────────────────
// Create a flexible group
router.post('/flexible', requireProfileComplete, createFlexibleGroup);

// Flexible group lifecycle
router.post('/:id/activate',  requireProfileComplete, requireGroupAdmin, activateFlexibleGroup);
router.post('/:id/close',     requireProfileComplete, requireGroupAdmin, closeFlexibleGroup);
router.delete('/:id/flexible', requireProfileComplete, requireGroupAdmin, deleteFlexibleGroup);
router.patch('/:id/flexible-settings', requireProfileComplete, requireGroupAdmin, updateFlexibleGroupSettings);
router.post('/:id/flexible-leave', requireProfileComplete, leaveFlexibleGroup);

// Flexible contributions
router.post('/:id/flexible-contributions', requireProfileComplete, contributeFlexible);
router.get('/:id/flexible-contributions',  getFlexibleContributions);
router.get('/:id/flexible-pool',           getFlexiblePoolSummary);

// Flexible disbursements
router.post('/:id/flexible-disbursements',                        requireProfileComplete, requireGroupAdmin, createDisbursement);
router.get('/:id/flexible-disbursements',                         getDisbursements);
router.patch('/:id/flexible-disbursements/:disbursementId',       requireProfileComplete, requireGroupAdmin, updateDisbursement);

module.exports = router;
