DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tax_exemption_status') THEN
    CREATE TYPE tax_exemption_status AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');
  END IF;
END $$;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_tax_exempt BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_exemption_status tax_exemption_status NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS resale_certificate_url TEXT,
  ADD COLUMN IF NOT EXISTS tax_exemption_rejection_reason TEXT;

UPDATE users
SET
  resale_certificate_url = COALESCE(resale_certificate_url, tax_document_url),
  tax_exemption_status = CASE
    WHEN tax_status = 'exempt' THEN 'APPROVED'::tax_exemption_status
    WHEN tax_document_url IS NOT NULL AND tax_status <> 'exempt' THEN 'PENDING'::tax_exemption_status
    ELSE tax_exemption_status
  END,
  is_tax_exempt = CASE
    WHEN tax_status = 'exempt' THEN true
    ELSE is_tax_exempt
  END
WHERE resale_certificate_url IS NULL
   OR tax_exemption_status = 'NONE';

ALTER TABLE admin_permissions
  ADD COLUMN IF NOT EXISTS can_approve_tax_exemption BOOLEAN NOT NULL DEFAULT false;

UPDATE admin_permissions
SET can_approve_tax_exemption = true
WHERE is_super_admin = true;

CREATE INDEX IF NOT EXISTS idx_users_tax_exemption_status
  ON users(tax_exemption_status)
  WHERE tax_exemption_status = 'PENDING';
