const { Router } = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { getUsers, getStats, updateUser, getUserLocations } = require('../controllers/adminController');

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/stats',     getStats);
router.get('/users',     getUsers);
router.get('/locations', getUserLocations);
router.patch('/users/:id', updateUser);

module.exports = router;
