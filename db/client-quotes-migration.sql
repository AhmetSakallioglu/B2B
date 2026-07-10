ALTER TABLE users
  ADD COLUMN IF NOT EXISTS company_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS custom_quote_footer_text TEXT;

CREATE TABLE IF NOT EXISTS client_quotes (
  id                 SERIAL PRIMARY KEY,
  user_id            INTEGER        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_name        VARCHAR(200)   NOT NULL,
  client_email       VARCHAR(255),
  markup_percentage  NUMERIC(6, 2)  NOT NULL DEFAULT 0
                     CHECK (markup_percentage >= 0 AND markup_percentage <= 100),
  include_tax        BOOLEAN        NOT NULL DEFAULT false,
  include_shipping   BOOLEAN        NOT NULL DEFAULT false,
  items              JSONB          NOT NULL,
  msrp_subtotal      NUMERIC(12, 2) NOT NULL CHECK (msrp_subtotal >= 0),
  client_subtotal    NUMERIC(12, 2) NOT NULL CHECK (client_subtotal >= 0),
  tax_amount         NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  shipping_amount    NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (shipping_amount >= 0),
  total_amount       NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
  pdf_url            TEXT,
  status             VARCHAR(20)    NOT NULL DEFAULT 'PENDING'
                     CHECK (status IN ('PENDING', 'CONVERTED', 'EXPIRED')),
  created_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_quotes_user_id ON client_quotes (user_id);
CREATE INDEX IF NOT EXISTS idx_client_quotes_created_at ON client_quotes (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_quotes_status ON client_quotes (status);
CREATE INDEX IF NOT EXISTS idx_client_quotes_user_status ON client_quotes (user_id, status);
