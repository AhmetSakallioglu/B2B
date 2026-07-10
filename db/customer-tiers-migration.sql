-- Customer tier levels for volume / partner discounts.

CREATE TABLE IF NOT EXISTS customer_tiers (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(100) NOT NULL,
  level            INTEGER      NOT NULL UNIQUE CHECK (level > 0),
  discount_percent NUMERIC(5, 2) NOT NULL CHECK (discount_percent >= 0 AND discount_percent <= 100),
  description      TEXT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS tier_id INTEGER REFERENCES customer_tiers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_tier_id ON users(tier_id);
CREATE INDEX IF NOT EXISTS idx_customer_tiers_level ON customer_tiers(level);

INSERT INTO customer_tiers (name, level, discount_percent, description)
VALUES
  ('1st degree', 1, 60, 'Highest partner tier — 60% catalog discount'),
  ('2nd degree', 2, 50, 'Second partner tier — 50% catalog discount')
ON CONFLICT (level) DO NOTHING;
