const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/database');

const router = Router();
router.use(authenticate);

/**
 * GET /terms/check?type=admin_approval&group_id=xxx
 * Returns whether the user needs to see the terms modal before proceeding.
 */
router.get('/check', async (req, res, next) => {
  try {
    const { type, group_id } = req.query;
    if (!type) return res.status(400).json({ success: false, message: 'type is required' });

    // Check if user has any acceptance record
    const acceptance = await query(
      'SELECT * FROM terms_acceptance WHERE user_id = $1 AND terms_type = $2',
      [req.user.id, type]
    );

    // Never accepted before — must show
    if (!acceptance.rows[0]) {
      return res.json({ success: true, data: { must_show: true, reason: 'first_time' } });
    }

    const { reminder_frequency } = acceptance.rows[0];

    // User chose "never" — don't show
    if (reminder_frequency === 'never') {
      return res.json({ success: true, data: { must_show: false } });
    }

    // User chose "every_time" — always show
    if (reminder_frequency === 'every_time') {
      return res.json({ success: true, data: { must_show: true, reason: 'every_time', reminder_frequency } });
    }

    // User chose "per_group" — check if they've accepted for this specific group
    if (reminder_frequency === 'per_group') {
      if (!group_id) return res.json({ success: true, data: { must_show: true, reason: 'per_group', reminder_frequency } });
      const groupAcceptance = await query(
        'SELECT id FROM terms_acceptance_groups WHERE user_id = $1 AND group_id = $2 AND terms_type = $3',
        [req.user.id, group_id, type]
      );
      const must_show = !groupAcceptance.rows[0];
      return res.json({ success: true, data: { must_show, reason: must_show ? 'new_group' : null, reminder_frequency } });
    }

    res.json({ success: true, data: { must_show: true } });
  } catch (error) { next(error); }
});

/**
 * POST /terms/accept
 * Records that the user accepted the terms, with their chosen reminder frequency.
 */
router.post('/accept', async (req, res, next) => {
  try {
    const { type, reminder_frequency = 'every_time', group_id } = req.body;
    if (!type) return res.status(400).json({ success: false, message: 'type is required' });

    // Upsert the acceptance record with chosen frequency
    await query(
      `INSERT INTO terms_acceptance (user_id, terms_type, reminder_frequency, accepted_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, terms_type) DO UPDATE SET reminder_frequency = $3, accepted_at = NOW()`,
      [req.user.id, type, reminder_frequency]
    );

    // If per_group, also record this specific group
    if (reminder_frequency === 'per_group' && group_id) {
      await query(
        `INSERT INTO terms_acceptance_groups (user_id, group_id, terms_type)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, group_id, terms_type) DO NOTHING`,
        [req.user.id, group_id, type]
      );
    }

    res.json({ success: true, message: 'Terms accepted' });
  } catch (error) { next(error); }
});

module.exports = router;
