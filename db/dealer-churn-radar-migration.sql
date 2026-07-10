-- Dealer churn radar: last login tracking + admin permissions.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

UPDATE users u
SET last_login_at = COALESCE(
  (
    SELECT MAX(o.created_at)
    FROM orders o
    WHERE o.user_id = u.id
  ),
  u.updated_at
)
WHERE u.last_login_at IS NULL
  AND u.role = 'customer';

ALTER TABLE admin_permissions
  ADD COLUMN IF NOT EXISTS can_view_churn_radar BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_manage_churn_recovery BOOLEAN NOT NULL DEFAULT false;

UPDATE admin_permissions
SET
  can_view_churn_radar = true,
  can_manage_churn_recovery = true
WHERE is_super_admin = true;

CREATE INDEX IF NOT EXISTS idx_users_last_login_at
  ON users(last_login_at DESC NULLS LAST)
  WHERE role = 'customer';
