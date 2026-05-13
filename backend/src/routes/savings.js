const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { getGoals, getGoal, createGoal, updateGoal, deposit, withdraw, deleteGoal } = require('../controllers/savingsController');

const router = Router();
// Savings only requires phone verification, NOT identity verification
router.use(authenticate);

router.get('/',          getGoals);
router.get('/:id',       getGoal);
router.post('/',         createGoal);
router.patch('/:id',     updateGoal);
router.post('/:id/deposit',  deposit);
router.post('/:id/withdraw', withdraw);
router.delete('/:id',    deleteGoal);

module.exports = router;
