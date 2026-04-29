-- Store terms acceptance preferences per user
CREATE TABLE IF NOT EXISTS terms_acceptance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  terms_type VARCHAR(30) NOT NULL CHECK (terms_type IN ('admin_approval', 'invite_vouching')),
  accepted_at TIMESTAMP DEFAULT NOW(),
  reminder_frequency VARCHAR(20) DEFAULT 'every_time' CHECK (reminder_frequency IN ('every_time', 'per_group', 'never')),
  UNIQUE(user_id, terms_type)
);

-- Track which groups an admin has already accepted terms for (for per_group frequency)
CREATE TABLE IF NOT EXISTS terms_acceptance_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  terms_type VARCHAR(30) NOT NULL,
  accepted_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, group_id, terms_type)
);
