DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dealer_tax_status') THEN
    CREATE TYPE dealer_tax_status AS ENUM ('taxable', 'exempt');
  END IF;
END $$;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS tax_status dealer_tax_status NOT NULL DEFAULT 'taxable',
  ADD COLUMN IF NOT EXISTS business_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS expected_monthly_sales VARCHAR(50),
  ADD COLUMN IF NOT EXISTS sales_tax_account VARCHAR(100),
  ADD COLUMN IF NOT EXISTS has_resale_license BOOLEAN,
  ADD COLUMN IF NOT EXISTS tax_document_url TEXT;
