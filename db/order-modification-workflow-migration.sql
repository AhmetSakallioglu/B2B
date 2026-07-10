-- Secure order modification workflow: extended statuses, Stripe fields, admin permission.

DO $$
BEGIN
  ALTER TYPE order_status ADD VALUE 'processing';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE order_status ADD VALUE 'shipped';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE order_status ADD VALUE 'cancelled';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE order_status ADD VALUE 'waiting_for_modification_payment';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE admin_permissions
  ADD COLUMN IF NOT EXISTS can_edit_orders BOOLEAN NOT NULL DEFAULT false;

UPDATE admin_permissions
SET can_edit_orders = true
WHERE is_super_admin = true;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_charge_id TEXT,
  ADD COLUMN IF NOT EXISTS modification_balance_due NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS modification_checkout_session_id TEXT,
  ADD COLUMN IF NOT EXISTS pending_modification JSONB,
  ADD COLUMN IF NOT EXISTS pre_modification_status order_status;
