const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { getMe, updateMe, getMyGroups, getNotifications, markRead } = require('../controllers/userController');

const router = Router();

router.use(authenticate);

router.get('/me', getMe);
router.patch('/me', updateMe);
router.get('/me/groups', getMyGroups);
router.get('/me/notifications', getNotifications);
router.patch('/me/notifications/:id/read', markRead);

module.exports = router;
