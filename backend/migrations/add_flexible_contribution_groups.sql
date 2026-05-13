-- Migration: Flexible Contribution Groups
-- Adds group_type, pool_balance, goal_amount to groups table
-- Creates flexible_contributions and flexible_disbursements tables

-- 1. Add group_type to groups table (defaults to 'njangi' — all existing rows unaffected)
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS group_type VARCHAR(10) NOT NULL DEFAULT 'njangi'
    CHECK (group_type IN ('njangi', 'flexible'));

-- 2. Add pool_balance to groups table (running total for flexible groups)
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS pool_balance DECIMAL(12,2) NOT NULL DEFAULT 0.00;

-- 3. Add goal_amount to groups table (optional fundraising target for flexible groups)
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS goal_amount DECIMAL(12,2) NULL
    CHECK (goal_amount IS NULL OR goal_amount > 0);

-- 4. Flexible contributions table
CREATE TABLE IF NOT EXISTS flexible_contributions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id        UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id),
  amount          DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  payment_method  VARCHAR(30) NOT NULL,
  transaction_id  VARCHAR(100),
  note            TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'completed', 'failed')),
  paid_at         TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flex_contributions_group  ON flexible_contributions(group_id);
CREATE INDEX IF NOT EXISTS idx_flex_contributions_user   ON flexible_contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_flex_contributions_status ON flexible_contributions(group_id, status);

-- 5. Flexible disbursements table
CREATE TABLE IF NOT EXISTS flexible_disbursements (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id              UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  admin_id              UUID NOT NULL REFERENCES users(id),
  amount                DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  recipient_id          UUID REFERENCES users(id),
  recipient_description TEXT,
  disbursement_method   VARCHAR(30) NOT NULL
                          CHECK (disbursement_method IN ('tc_wallet','mtn_momo','orange_money','bank_transfer','manual')),
  note                  TEXT,
  status                VARCHAR(20) NOT NULL DEFAULT 'completed'
                          CHECK (status IN ('completed')),
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flex_disbursements_group ON flexible_disbursements(group_id);
CREATE INDEX IF NOT EXISTS idx_flex_disbursements_admin ON flexible_disbursements(admin_id);

-- Allow contribution_amount to be NULL for flexible groups
ALTER TABLE groups ALTER COLUMN contribution_amount DROP NOT NULL;
-- Allow cycle to be NULL for flexible groups
ALTER TABLE groups ALTER COLUMN cycle DROP NOT NULL;

-- Optional fundraising deadline for flexible groups
ALTER TABLE groups ADD COLUMN IF NOT EXISTS fundraiser_deadline DATE NULL;
