-- User impersonation: order attribution + admin permission.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS placed_by_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_placed_by_admin_id
  ON orders(placed_by_admin_id)
  WHERE placed_by_admin_id IS NOT NULL;

ALTER TABLE admin_permissions
  ADD COLUMN IF NOT EXISTS can_impersonate_users BOOLEAN NOT NULL DEFAULT false;
