ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS visibility         VARCHAR(20) DEFAULT 'public'
    CHECK (visibility IN ('public', 'private', 'region')),
  ADD COLUMN IF NOT EXISTS visibility_country VARCHAR(100),
  ADD COLUMN IF NOT EXISTS visibility_city    VARCHAR(100);
