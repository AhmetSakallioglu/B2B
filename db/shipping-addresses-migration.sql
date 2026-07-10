-- Dealer shipping address book (multi-site delivery addresses).

CREATE TABLE IF NOT EXISTS shipping_addresses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  address_title   VARCHAR(150) NOT NULL,
  street_address  VARCHAR(255) NOT NULL,
  city            VARCHAR(100) NOT NULL,
  state           VARCHAR(50) NOT NULL DEFAULT 'TX',
  zip_code        VARCHAR(20) NOT NULL,
  contact_person  VARCHAR(150),
  contact_phone   VARCHAR(50),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipping_addresses_user_id
  ON shipping_addresses(user_id);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipping_address_id UUID REFERENCES shipping_addresses(id) ON DELETE SET NULL;
