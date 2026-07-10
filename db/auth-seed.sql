-- =============================================================================
-- Auth seed — admin test user (password: admin123)
-- Run AFTER auth-migration.sql
-- =============================================================================

INSERT INTO users (email, password_hash, role, account_status, reviewed_at)
VALUES (
  'admin@cabinet.local',
  '$2b$10$c/vfOh.GmrePHXBl9EmS4ejldfHScX389tFjEKikQAljJKSEDCaiO',
  'admin',
  'approved',
  NOW()
)
ON CONFLICT (email) DO UPDATE
SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  account_status = 'approved',
  reviewed_at = COALESCE(users.reviewed_at, NOW());
