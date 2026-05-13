-- Track partial/installment contributions per member per cycle
CREATE TABLE IF NOT EXISTS contribution_installments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id        UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id),
  cycle_number    INTEGER NOT NULL,
  amount_xaf      DECIMAL(12,2) NOT NULL,
  payment_method  VARCHAR(30) NOT NULL,
  transaction_id  VARCHAR(100),
  status          VARCHAR(20) DEFAULT 'completed',
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_installments_group_cycle ON contribution_installments(group_id, cycle_number);
CREATE INDEX IF NOT EXISTS idx_installments_user ON contribution_installments(user_id, group_id);

-- Autopay settings per member per group
CREATE TABLE IF NOT EXISTS member_autopay (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id    UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id),
  enabled     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- Early payout requests
CREATE TABLE IF NOT EXISTS early_payout_requests (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id    UUID REFERENCES groups(id) ON DELETE CASCADE,
  payout_id   UUID REFERENCES payouts(id),
  user_id     UUID REFERENCES users(id),
  fee_percent DECIMAL(5,4) DEFAULT 0.005,
  status      VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at  TIMESTAMP DEFAULT NOW()
);
