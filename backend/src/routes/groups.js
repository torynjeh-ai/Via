const { Router } = require('express');
const { authenticate, requireGroupAdmin, requireProfileComplete } = require('../middleware/auth');
const { createGroup, getGroups, getGroup, joinGroup, approveMember, startGroup, updateGroup, getPayouts, getInviteLink, joinByInvite, endCircle, reconfirmMembership, forfeitMembership, startNextCircle } = require('../controllers/groupController');
const { contribute, getContributions } = require('../controllers/contributionController');

const router = Router();

router.use(authenticate);

// Read-only routes — no profile required
router.get('/', getGroups);
router.get('/:id', getGroup);
router.get('/:id/payouts', getPayouts);
router.get('/:id/contributions', getContributions);
router.get('/:id/invite', getInviteLink);

// Join via invite link
router.post('/join-by-invite/:token', requireProfileComplete, joinByInvite);

// Write routes — profile must be complete
router.post('/', requireProfileComplete, createGroup);
router.post('/:id/join', requireProfileComplete, joinGroup);
router.post('/:id/start', requireProfileComplete, requireGroupAdmin, startGroup);
router.post('/:id/end-circle', requireProfileComplete, requireGroupAdmin, endCircle);
router.post('/:id/start-next-circle', requireProfileComplete, requireGroupAdmin, startNextCircle);
router.post('/:id/reconfirm', requireProfileComplete, reconfirmMembership);
router.post('/:id/forfeit', requireProfileComplete, forfeitMembership);
router.patch('/:id', requireProfileComplete, requireGroupAdmin, updateGroup);
router.patch('/:id/members/:userId/approve', requireProfileComplete, requireGroupAdmin, approveMember);
router.post('/:id/contribute', requireProfileComplete, contribute);

module.exports = router;
