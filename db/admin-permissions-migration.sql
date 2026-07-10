-- Admin RBAC permissions (one row per admin user).

CREATE TABLE IF NOT EXISTS admin_permissions (
  user_id                   INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  is_super_admin            BOOLEAN NOT NULL DEFAULT false,
  can_view_logs             BOOLEAN NOT NULL DEFAULT false,
  can_restore_logs          BOOLEAN NOT NULL DEFAULT false,
  can_approve_users         BOOLEAN NOT NULL DEFAULT false,
  can_ban_users             BOOLEAN NOT NULL DEFAULT false,
  can_view_user_tiers       BOOLEAN NOT NULL DEFAULT false,
  can_change_user_tier      BOOLEAN NOT NULL DEFAULT false,
  can_add_tiers             BOOLEAN NOT NULL DEFAULT false,
  can_delete_tiers          BOOLEAN NOT NULL DEFAULT false,
  can_edit_tiers            BOOLEAN NOT NULL DEFAULT false,
  can_view_products         BOOLEAN NOT NULL DEFAULT false,
  can_add_products          BOOLEAN NOT NULL DEFAULT false,
  can_delete_products       BOOLEAN NOT NULL DEFAULT false,
  can_toggle_products       BOOLEAN NOT NULL DEFAULT false,
  can_bulk_upload_products  BOOLEAN NOT NULL DEFAULT false,
  can_add_finishes          BOOLEAN NOT NULL DEFAULT false,
  can_delete_finishes       BOOLEAN NOT NULL DEFAULT false,
  can_toggle_finishes       BOOLEAN NOT NULL DEFAULT false,
  can_view_orders           BOOLEAN NOT NULL DEFAULT false,
  can_change_order_status   BOOLEAN NOT NULL DEFAULT false,
  can_send_quickbooks       BOOLEAN NOT NULL DEFAULT false,
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by                INTEGER REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO admin_permissions (
  user_id,
  is_super_admin,
  can_view_logs,
  can_restore_logs,
  can_approve_users,
  can_ban_users,
  can_view_user_tiers,
  can_change_user_tier,
  can_add_tiers,
  can_delete_tiers,
  can_edit_tiers,
  can_view_products,
  can_add_products,
  can_delete_products,
  can_toggle_products,
  can_bulk_upload_products,
  can_add_finishes,
  can_delete_finishes,
  can_toggle_finishes,
  can_view_orders,
  can_change_order_status,
  can_send_quickbooks
)
SELECT
  u.id,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true
FROM users u
WHERE u.role = 'admin'
ORDER BY u.created_at ASC, u.id ASC
LIMIT 1
ON CONFLICT (user_id) DO UPDATE
SET
  is_super_admin = true,
  can_view_logs = true,
  can_restore_logs = true,
  can_approve_users = true,
  can_ban_users = true,
  can_view_user_tiers = true,
  can_change_user_tier = true,
  can_add_tiers = true,
  can_delete_tiers = true,
  can_edit_tiers = true,
  can_view_products = true,
  can_add_products = true,
  can_delete_products = true,
  can_toggle_products = true,
  can_bulk_upload_products = true,
  can_add_finishes = true,
  can_delete_finishes = true,
  can_toggle_finishes = true,
  can_view_orders = true,
  can_change_order_status = true,
  can_send_quickbooks = true;

-- Ensure every other admin has a permissions row (defaults = no access).
INSERT INTO admin_permissions (user_id)
SELECT u.id
FROM users u
WHERE u.role = 'admin'
ON CONFLICT (user_id) DO NOTHING;
