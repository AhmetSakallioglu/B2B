CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- User-bound promo codes for abandoned cart recovery and marketing.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS promo_codes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(32) NOT NULL UNIQUE,
  discount_type   VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value  NUMERIC(10, 2) NOT NULL CHECK (discount_value > 0),
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_used         BOOLEAN NOT NULL DEFAULT false,
  expires_at      TIMESTAMPTZ NOT NULL,
  used_at         TIMESTAMPTZ,
  order_id        INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_user_id ON promo_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_promo_codes_code_upper ON promo_codes(UPPER(code));
CREATE INDEX IF NOT EXISTS idx_promo_codes_active_user
  ON promo_codes(user_id, is_used, expires_at DESC);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10, 2);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS promo_discount NUMERIC(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS promo_code_id UUID REFERENCES promo_codes(id) ON DELETE SET NULL;
