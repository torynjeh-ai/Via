-- Add invite_token to groups if missing
ALTER TABLE groups ADD COLUMN IF NOT EXISTS invite_token VARCHAR(64) UNIQUE;
