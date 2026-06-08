const { Router } = require('express');
const { authenticate, requireAdmin, requireSuperAdmin } = require('../middleware/auth');
const { getUsers, getStats, updateUser, getUserLocations, getGroups, getFinancials } = require('../controllers/adminController');

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/stats',     getStats);
router.get('/users',     getUsers);
router.get('/locations', getUserLocations);

// Superadmin-only routes
router.get('/groups',    requireSuperAdmin, getGroups);
router.get('/financials', requireSuperAdmin, getFinancials);
router.patch('/users/:id', requireSuperAdmin, updateUser); // role/active changes

module.exports = router;
