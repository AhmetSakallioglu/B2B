-- Zip-based shipping zones, settings, order snapshots, and admin permission.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS shipping_settings (
  id                         INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  default_out_of_zone_rate   NUMERIC(10, 2) NOT NULL DEFAULT 500 CHECK (default_out_of_zone_rate >= 0),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO shipping_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS shipping_zones (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_name               VARCHAR(200) NOT NULL,
  base_price              NUMERIC(10, 2) NOT NULL CHECK (base_price >= 0),
  zip_codes               TEXT[] NOT NULL CHECK (cardinality(zip_codes) > 0),
  free_shipping_threshold NUMERIC(10, 2) CHECK (free_shipping_threshold IS NULL OR free_shipping_threshold >= 0),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipping_zones_zip_codes
  ON shipping_zones USING GIN (zip_codes);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipping_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_zone_id UUID REFERENCES shipping_zones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shipping_zone_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS shipping_postal_code VARCHAR(20);

ALTER TABLE admin_permissions
  ADD COLUMN IF NOT EXISTS can_manage_shipping_zones BOOLEAN NOT NULL DEFAULT false;

UPDATE admin_permissions
SET can_manage_shipping_zones = true
WHERE is_super_admin = true;
