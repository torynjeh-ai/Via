-- Security constraints migration

-- 1. Unique constraint on wallet_transactions.external_tx_id to prevent double-credit
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_tx_external_id_unique
  ON wallet_transactions(external_tx_id)
  WHERE external_tx_id IS NOT NULL;

-- 2. Prevent duplicate completed contributions per user per cycle
CREATE UNIQUE INDEX IF NOT EXISTS idx_contributions_unique_per_cycle
  ON contributions(group_id, user_id, cycle_number)
  WHERE status = 'completed';

-- 3. Index for faster OTP lookups
CREATE INDEX IF NOT EXISTS idx_otps_phone_unused
  ON otps(phone, is_used, expires_at)
  WHERE is_used = FALSE;
