-- Email campaigns, dealer groups, coupon toggles, and dedicated admin permissions.

ALTER TABLE admin_permissions
  ADD COLUMN IF NOT EXISTS can_manage_coupons BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE admin_permissions
  ADD COLUMN IF NOT EXISTS can_manage_emails BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE admin_permissions
  ADD COLUMN IF NOT EXISTS can_send_bulk_emails BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE admin_permissions
  ADD COLUMN IF NOT EXISTS can_manage_dealer_groups BOOLEAN NOT NULL DEFAULT false;

UPDATE admin_permissions
SET
  can_manage_coupons = true,
  can_manage_emails = true,
  can_send_bulk_emails = true,
  can_manage_dealer_groups = true
WHERE is_super_admin = true;

ALTER TABLE group_promo_rates
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE abandoned_cart_settings
  ADD COLUMN IF NOT EXISTS automatic_coupons_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE abandoned_cart_settings
  ADD COLUMN IF NOT EXISTS promo_expiry_days INTEGER NOT NULL DEFAULT 7
  CHECK (promo_expiry_days >= 1 AND promo_expiry_days <= 365);

ALTER TABLE automation_settings
  ADD COLUMN IF NOT EXISTS delay_hours NUMERIC(8, 2);

ALTER TABLE automation_settings
  ADD COLUMN IF NOT EXISTS issue_promo BOOLEAN NOT NULL DEFAULT true;

UPDATE automation_settings
SET delay_hours = 2
WHERE step_number = 1 AND delay_hours IS NULL;

UPDATE automation_settings
SET delay_hours = 24
WHERE step_number = 2 AND delay_hours IS NULL;

UPDATE automation_settings
SET delay_hours = 48
WHERE step_number = 3 AND delay_hours IS NULL;

ALTER TABLE email_templates
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE email_templates
  ADD COLUMN IF NOT EXISTS automation_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE email_templates
  ADD COLUMN IF NOT EXISTS delay_hours NUMERIC(8, 2);

CREATE TABLE IF NOT EXISTS dealer_groups (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dealer_group_members (
  group_id INTEGER NOT NULL REFERENCES dealer_groups(id) ON DELETE CASCADE,
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_dealer_group_members_user_id ON dealer_group_members(user_id);
