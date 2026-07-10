-- Global and per-template coupon validity (days until expiry).

ALTER TABLE abandoned_cart_settings
  ADD COLUMN IF NOT EXISTS promo_expiry_days INTEGER NOT NULL DEFAULT 7
  CHECK (promo_expiry_days >= 1 AND promo_expiry_days <= 365);

ALTER TABLE email_templates
  ADD COLUMN IF NOT EXISTS promo_expiry_days INTEGER
  CHECK (promo_expiry_days IS NULL OR (promo_expiry_days >= 1 AND promo_expiry_days <= 365));
