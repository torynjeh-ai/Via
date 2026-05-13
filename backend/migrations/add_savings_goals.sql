CREATE TABLE IF NOT EXISTS savings_goals (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  name            VARCHAR(100) NOT NULL,
  description     TEXT,
  category        VARCHAR(50),
  target_amount   DECIMAL(12,2) NOT NULL,
  saved_amount    DECIMAL(12,2) DEFAULT 0,
  target_date     DATE NOT NULL,
  auto_save_enabled  BOOLEAN DEFAULT FALSE,
  auto_save_amount   DECIMAL(12,2),
  auto_save_frequency VARCHAR(20) CHECK (auto_save_frequency IN ('daily','weekly','monthly')),
  status          VARCHAR(20) DEFAULT 'active'
    CHECK (status IN ('active','completed','withdrawn')),
  completed_at    TIMESTAMP,
  withdrawn_at    TIMESTAMP,
  early_withdrawal_fee DECIMAL(5,4) DEFAULT 0.02,
  bonus_earned    DECIMAL(12,2) DEFAULT 0,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS savings_deposits (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id         UUID REFERENCES savings_goals(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id),
  amount_xaf      DECIMAL(12,2) NOT NULL,
  payment_method  VARCHAR(30) NOT NULL,
  transaction_id  VARCHAR(100),
  is_auto_save    BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_savings_goals_user ON savings_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_savings_deposits_goal ON savings_deposits(goal_id);
