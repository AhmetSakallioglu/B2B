-- Per-template promo code issuance settings for manual and bulk sends.

ALTER TABLE email_templates
  ADD COLUMN IF NOT EXISTS issue_promo_on_send BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE email_templates
  ADD COLUMN IF NOT EXISTS promo_discount_percent NUMERIC(5, 2);
