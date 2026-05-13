-- Admin Requests Migration
-- Creates admin_requests and admin_request_votes tables for the group admin promotion workflow

-- 1. admin_requests table
CREATE TABLE IF NOT EXISTS admin_requests (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id      UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  requester_id  UUID NOT NULL REFERENCES users(id),
  status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW(),
  UNIQUE (group_id, requester_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_requests_group     ON admin_requests(group_id);
CREATE INDEX IF NOT EXISTS idx_admin_requests_requester ON admin_requests(requester_id);

-- 2. admin_request_votes table
CREATE TABLE IF NOT EXISTS admin_request_votes (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id       UUID NOT NULL REFERENCES admin_requests(id) ON DELETE CASCADE,
  admin_id         UUID NOT NULL REFERENCES users(id),
  vote             VARCHAR(20) CHECK (vote IN ('approved', 'rejected')),
  rejection_reason TEXT,
  voted_at         TIMESTAMP,
  UNIQUE (request_id, admin_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_request_votes_request ON admin_request_votes(request_id);
