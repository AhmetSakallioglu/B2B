-- Adds company / address profile fields to users.
-- Safe to run multiple times.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS company_name  VARCHAR(150),
  ADD COLUMN IF NOT EXISTS contact_name  VARCHAR(150),
  ADD COLUMN IF NOT EXISTS phone         VARCHAR(50),
  ADD COLUMN IF NOT EXISTS address_line1 VARCHAR(255),
  ADD COLUMN IF NOT EXISTS address_line2 VARCHAR(255),
  ADD COLUMN IF NOT EXISTS city          VARCHAR(100),
  ADD COLUMN IF NOT EXISTS state         VARCHAR(100),
  ADD COLUMN IF NOT EXISTS postal_code   VARCHAR(30),
  ADD COLUMN IF NOT EXISTS country       VARCHAR(100) DEFAULT 'United States',
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW();
