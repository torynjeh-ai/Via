CREATE TABLE IF NOT EXISTS savings_withdrawals (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id           UUID REFERENCES savings_goals(id) ON DELETE CASCADE,
  user_id           UUID REFERENCES users(id),
  gross_amount_xaf  DECIMAL(12,2) NOT NULL,
  fee_xaf           DECIMAL(12,2) NOT NULL DEFAULT 0,
  net_amount_xaf    DECIMAL(12,2) NOT NULL,
  withdrawal_method VARCHAR(30) NOT NULL DEFAULT 'tc_wallet',
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_savings_withdrawals_user ON savings_withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_savings_withdrawals_goal ON savings_withdrawals(goal_id);
