CREATE TABLE IF NOT EXISTS pending_registrations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone         VARCHAR(20) UNIQUE NOT NULL,
  name          VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255),
  created_at    TIMESTAMP DEFAULT NOW(),
  expires_at    TIMESTAMP DEFAULT NOW() + INTERVAL '10 minutes'
);
