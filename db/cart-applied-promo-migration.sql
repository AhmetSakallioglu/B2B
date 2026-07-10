-- Server-side cart promo state (prevents duplicate coupon application / stacking).

CREATE TABLE IF NOT EXISTS cart_applied_promos (
  user_id          INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  promo_code_id    UUID NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  code             VARCHAR(32) NOT NULL,
  promo_discount   NUMERIC(10, 2) NOT NULL DEFAULT 0,
  subtotal_at_apply NUMERIC(10, 2) NOT NULL DEFAULT 0,
  applied_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cart_applied_promos_code_upper
  ON cart_applied_promos(user_id, UPPER(code));
