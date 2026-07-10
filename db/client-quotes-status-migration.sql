ALTER TABLE client_quotes
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'CONVERTED', 'EXPIRED'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'client_quotes'
      AND column_name = 'final_pdf_url'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'client_quotes'
      AND column_name = 'pdf_url'
  ) THEN
    ALTER TABLE client_quotes RENAME COLUMN final_pdf_url TO pdf_url;
  END IF;
END $$;

ALTER TABLE client_quotes
  ADD COLUMN IF NOT EXISTS pdf_url TEXT;

CREATE INDEX IF NOT EXISTS idx_client_quotes_status ON client_quotes (status);
CREATE INDEX IF NOT EXISTS idx_client_quotes_user_status ON client_quotes (user_id, status);
