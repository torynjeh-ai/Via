-- Add re-forming support

-- Add 're-forming' status to groups and circle_number tracking
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS circle_number INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS re_forming_since TIMESTAMP;

-- Update groups status check to include 're-forming'
ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_status_check;
ALTER TABLE groups ADD CONSTRAINT groups_status_check
  CHECK (status IN ('forming', 'active', 're-forming', 'completed', 'cancelled'));

-- Add re-confirmation status to members
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_status_check;
ALTER TABLE members ADD CONSTRAINT members_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'left', 'forfeited', 'pending_reconfirm'));
