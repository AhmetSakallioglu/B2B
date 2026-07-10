-- User segmentation, granular automation steps, and promo code sources.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS group_tag VARCHAR(50) NOT NULL DEFAULT 'New';

CREATE INDEX IF NOT EXISTS idx_users_group_tag ON users(group_tag);

ALTER TABLE promo_codes
  ADD COLUMN IF NOT EXISTS creation_type VARCHAR(20) NOT NULL DEFAULT 'AUTOMATIC';

ALTER TABLE promo_codes
  DROP CONSTRAINT IF EXISTS promo_codes_creation_type_check;

ALTER TABLE promo_codes
  ADD CONSTRAINT promo_codes_creation_type_check
  CHECK (creation_type IN ('AUTOMATIC', 'MANUAL'));

CREATE TABLE IF NOT EXISTS automation_settings (
  id                    SERIAL PRIMARY KEY,
  step_number           SMALLINT NOT NULL UNIQUE CHECK (step_number BETWEEN 1 AND 3),
  is_active             BOOLEAN NOT NULL DEFAULT true,
  target_group          VARCHAR(50) NOT NULL DEFAULT 'All',
  discount_percentage   NUMERIC(5, 2) NOT NULL DEFAULT 5 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS group_promo_rates (
  group_tag             VARCHAR(50) PRIMARY KEY,
  discount_percentage   NUMERIC(5, 2) NOT NULL DEFAULT 5 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO automation_settings (step_number, is_active, target_group, discount_percentage)
VALUES
  (1, true, 'All', 5),
  (2, true, 'All', 5),
  (3, true, 'All', 5)
ON CONFLICT (step_number) DO NOTHING;

INSERT INTO group_promo_rates (group_tag, discount_percentage)
VALUES
  ('Tier 1', 3),
  ('Tier 2', 5),
  ('New', 5),
  ('Inactive', 8)
ON CONFLICT (group_tag) DO NOTHING;
