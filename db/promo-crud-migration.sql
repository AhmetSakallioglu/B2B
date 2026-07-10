-- Coupon activate/deactivate and granular admin permissions.

ALTER TABLE promo_codes
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE admin_permissions
  ADD COLUMN IF NOT EXISTS can_manage_coupons BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE admin_permissions
  ADD COLUMN IF NOT EXISTS can_delete_coupons BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE admin_permissions
  ADD COLUMN IF NOT EXISTS can_toggle_coupons BOOLEAN NOT NULL DEFAULT false;

UPDATE admin_permissions
SET
  can_manage_coupons = true,
  can_delete_coupons = true,
  can_toggle_coupons = true
WHERE is_super_admin = true;

UPDATE admin_permissions
SET
  can_delete_coupons = true,
  can_toggle_coupons = true
WHERE can_manage_coupons = true
  AND is_super_admin = false;

CREATE INDEX IF NOT EXISTS idx_promo_codes_is_active ON promo_codes(is_active);
