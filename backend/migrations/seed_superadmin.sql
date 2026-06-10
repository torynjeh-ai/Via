-- Promote the platform owner to superadmin
-- This is idempotent — safe to run multiple times
UPDATE users SET role = 'superadmin' WHERE phone = '+237651954823' AND role != 'superadmin';
