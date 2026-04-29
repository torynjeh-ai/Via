-- Trust Coin Wallet Migration
-- Renames trust_score → tc_balance, adds wallet fields, creates wallet_transactions table

-- 1. Rename trust_score → tc_balance and change type to DECIMAL(18,8)
ALTER TABLE users RENAME COLUMN trust_score TO tc_balance;
ALTER TABLE users ALTER COLUMN tc_balance TYPE DECIMAL(18,8) USING tc_balance::DECIMAL(18,8);
ALTER TABLE users ALTER COLUMN tc_balance SET DEFAULT 0.00000000;

-- 2. Add wallet_code and preferred_currency columns
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS wallet_code VARCHAR(10) UNIQUE,
  ADD COLUMN IF NOT EXISTS preferred_currency VARCHAR(3) DEFAULT 'XAF'
    CHECK (preferred_currency IN ('XAF','USD','EUR','GBP','NGN','GHS','KES'));

-- 3. Create wallet_transactions table
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type                 VARCHAR(20) NOT NULL
                         CHECK (type IN ('top_up','withdrawal','contribution','payout','transfer_in','transfer_out')),
  tc_amount            DECIMAL(18,8) NOT NULL,
  xaf_amount           DECIMAL(18,2),
  fee_tc               DECIMAL(18,8) DEFAULT 0,
  payment_method       VARCHAR(30),
  external_tx_id       VARCHAR(100),
  counterparty_user_id UUID REFERENCES users(id),
  counterparty_name    VARCHAR(100),
  group_id             UUID REFERENCES groups(id),
  payout_id            UUID REFERENCES payouts(id),
  cycle_number         INTEGER,
  status               VARCHAR(20) DEFAULT 'completed'
                         CHECK (status IN ('pending','completed','failed','reversed')),
  created_at           TIMESTAMP DEFAULT NOW()
);

-- 4. Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_wallet_tx_user    ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_type    ON wallet_transactions(user_id, type);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_created ON wallet_transactions(user_id, created_at DESC);
