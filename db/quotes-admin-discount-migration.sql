-- Special admin discount applied on a saved dealer quote.

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS admin_discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'quotes_admin_discount_percent_check'
  ) THEN
    ALTER TABLE quotes
      ADD CONSTRAINT quotes_admin_discount_percent_check
      CHECK (admin_discount_percent >= 0 AND admin_discount_percent <= 100);
  END IF;
END $$;
