-- Add missing document verification columns to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS doc_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS doc_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS doc_image_back_url TEXT,
  ADD COLUMN IF NOT EXISTS preferred_currency VARCHAR(10) DEFAULT 'XAF',
  ADD COLUMN IF NOT EXISTS wallet_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS tc_balance DECIMAL(18,8) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS location_country VARCHAR(100),
  ADD COLUMN IF NOT EXISTS location_city VARCHAR(100);
