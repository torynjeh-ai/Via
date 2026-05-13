const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { getMe, updateMe, getMyGroups, getNotifications, markRead, setupProfile, updateProfilePicture, removeProfilePicture, updateLocation } = require('../controllers/userController');

const router = Router();

router.use(authenticate);

router.get('/me', getMe);
router.patch('/me', updateMe);
router.post('/me/setup-profile', setupProfile);
router.post('/me/profile-picture', updateProfilePicture);
router.delete('/me/profile-picture', removeProfilePicture);
router.post('/me/location', updateLocation);
router.get('/me/groups', getMyGroups);
router.get('/me/notifications', getNotifications);
router.patch('/me/notifications/:id/read', markRead);

module.exports = router;
