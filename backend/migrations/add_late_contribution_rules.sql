-- Add late contribution / penalty settings to groups
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS deadline_days_before INTEGER DEFAULT 2,
  ADD COLUMN IF NOT EXISTS late_penalty_type     VARCHAR(10) DEFAULT 'fixed' CHECK (late_penalty_type IN ('fixed', 'percent')),
  ADD COLUMN IF NOT EXISTS late_penalty_value    DECIMAL(10,2) DEFAULT 500;

-- Track penalty charges on contributions
ALTER TABLE contributions
  ADD COLUMN IF NOT EXISTS is_late       BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS penalty_amount DECIMAL(12,2) DEFAULT 0;

-- Track penalty distributions
CREATE TABLE IF NOT EXISTS penalty_distributions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id        UUID REFERENCES groups(id),
  cycle_number    INTEGER NOT NULL,
  total_penalty   DECIMAL(12,2) NOT NULL,
  platform_fee    DECIMAL(12,2) NOT NULL,
  member_share    DECIMAL(12,2) NOT NULL,
  distributed_at  TIMESTAMP DEFAULT NOW()
);
