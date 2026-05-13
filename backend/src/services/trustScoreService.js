/**
 * Trust Score Service
 *
 * Score = 5 components × 20 points each = 100 max
 *
 * 1. Phone verification   — 20 pts if is_verified = TRUE
 * 2. Identity verification — 20 pts if profile_complete = TRUE
 * 3. Location enabled     — 20 pts if location_enabled = TRUE
 * 4. Payment behaviour    — 0–20 pts based on contribution history
 * 5. TC wallet balance    — 0–20 pts based on tc_balance tiers
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

// ── Payment behaviour scoring ──────────────────────────────────────────────
// Points per event (clamped to 0–20)
const PAYMENT_POINTS = {
  on_time_contribution:  +2,
  late_contribution:     -3,
  penalty_paid:          -1,
  circle_completed:      +5,
  forfeited:             -5,
};

// ── TC balance tiers (XAF equivalent: 1 TC = 10,000 XAF) ──────────────────
// tc_balance is stored in TC units
const TC_TIERS = [
  { min: 0,    max: 0.0999, pts: 0  },
  { min: 0.1,  max: 0.4999, pts: 4  },
  { min: 0.5,  max: 0.9999, pts: 8  },
  { min: 1,    max: 2.9999, pts: 12 },
  { min: 3,    max: 9.9999, pts: 16 },
  { min: 10,   max: Infinity, pts: 20 },
];

const getTcBalancePoints = (tcBalance) => {
  const bal = Number(tcBalance) || 0;
  for (const tier of TC_TIERS) {
    if (bal >= tier.min && bal <= tier.max) return tier.pts;
  }
  return 0;
};

/**
 * Calculate and persist the trust score for a user.
 * Called whenever a relevant event occurs.
 */
const recalculateTrustScore = async (userId) => {
  try {
    // Fetch user data
    const userRes = await query(
      `SELECT is_verified, profile_complete, location_enabled, tc_balance FROM users WHERE id = $1`,
      [userId]
    );
    const user = userRes.rows[0];
    if (!user) return;

    // Component 1: Phone verification (20 pts)
    const phoneScore = user.is_verified ? 20 : 0;

    // Component 2: Identity verification (20 pts)
    const identityScore = user.profile_complete ? 20 : 0;

    // Component 3: Location enabled (20 pts)
    const locationScore = user.location_enabled ? 20 : 0;

    // Component 4: Payment behaviour (0–20 pts)
    // Count on-time vs late contributions and group events
    const [contribRes, circleRes, forfeitRes] = await Promise.all([
      query(
        `SELECT
           SUM(CASE WHEN is_late = FALSE AND status = 'completed' THEN 1 ELSE 0 END) as on_time,
           SUM(CASE WHEN is_late = TRUE  AND status = 'completed' THEN 1 ELSE 0 END) as late,
           SUM(CASE WHEN penalty_amount > 0 THEN 1 ELSE 0 END) as penalties
         FROM contributions WHERE user_id = $1`,
        [userId]
      ),
      // Completed circles: groups where user was approved and circle_number > 1
      query(
        `SELECT COUNT(DISTINCT g.id) as completed
         FROM groups g
         JOIN members m ON m.group_id = g.id AND m.user_id = $1
         WHERE g.circle_number > 1`,
        [userId]
      ),
      query(
        `SELECT COUNT(*) as forfeits FROM members WHERE user_id = $1 AND status = 'forfeited'`,
        [userId]
      ),
    ]);

    const onTime    = Number(contribRes.rows[0].on_time)   || 0;
    const late      = Number(contribRes.rows[0].late)      || 0;
    const penalties = Number(contribRes.rows[0].penalties) || 0;
    const circles   = Number(circleRes.rows[0].completed)  || 0;
    const forfeits  = Number(forfeitRes.rows[0].forfeits)  || 0;

    const rawPayment =
      onTime    * PAYMENT_POINTS.on_time_contribution +
      late      * PAYMENT_POINTS.late_contribution +
      penalties * PAYMENT_POINTS.penalty_paid +
      circles   * PAYMENT_POINTS.circle_completed +
      forfeits  * PAYMENT_POINTS.forfeited;

    const paymentScore = Math.min(20, Math.max(0, rawPayment));

    // Component 5: TC wallet balance (0–20 pts)
    const walletScore = getTcBalancePoints(user.tc_balance);

    // Total
    const total = phoneScore + identityScore + locationScore + paymentScore + walletScore;

    // Persist
    await query(
      `UPDATE users SET trust_score = $1, updated_at = NOW() WHERE id = $2`,
      [total, userId]
    );

    logger.info(`[TrustScore] User ${userId}: ${total}/100 (phone=${phoneScore} identity=${identityScore} location=${locationScore} payment=${paymentScore} wallet=${walletScore})`);

    return {
      total,
      breakdown: { phoneScore, identityScore, locationScore, paymentScore, walletScore },
    };
  } catch (err) {
    logger.error(`[TrustScore] Failed for user ${userId}: ${err.message}`);
  }
};

module.exports = { recalculateTrustScore, getTcBalancePoints, PAYMENT_POINTS };
