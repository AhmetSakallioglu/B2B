-- Dealer application fields on users (B2B registration).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS alternate_phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS fax VARCHAR(50),
  ADD COLUMN IF NOT EXISTS billing_first_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS billing_last_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS billing_phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS shipping_first_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS shipping_last_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS shipping_address_line1 VARCHAR(255),
  ADD COLUMN IF NOT EXISTS shipping_address_line2 VARCHAR(255),
  ADD COLUMN IF NOT EXISTS shipping_city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS shipping_state VARCHAR(100),
  ADD COLUMN IF NOT EXISTS shipping_postal_code VARCHAR(30),
  ADD COLUMN IF NOT EXISTS shipping_country VARCHAR(100) DEFAULT 'United States',
  ADD COLUMN IF NOT EXISTS shipping_phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS shipping_same_as_billing BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS federal_tax_id VARCHAR(20),
  ADD COLUMN IF NOT EXISTS application_notes TEXT;
