const { Router } = require('express');
const { authenticate, requireGroupAdmin } = require('../middleware/auth');
const { createGroup, getGroups, getGroup, joinGroup, approveMember, startGroup, getPayouts } = require('../controllers/groupController');
const { contribute, getContributions } = require('../controllers/contributionController');

const router = Router();

router.use(authenticate);

router.get('/', getGroups);
router.post('/', createGroup);
router.get('/:id', getGroup);
router.post('/:id/join', joinGroup);
router.post('/:id/start', requireGroupAdmin, startGroup);
router.patch('/:id/members/:userId/approve', requireGroupAdmin, approveMember);
router.get('/:id/payouts', getPayouts);
router.post('/:id/contribute', contribute);
router.get('/:id/contributions', getContributions);

module.exports = router;
