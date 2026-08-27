-- Saved dealer quote / project drafts

CREATE TABLE IF NOT EXISTS quotes (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quote_name    VARCHAR(150)   NOT NULL,
  items         JSONB          NOT NULL,
  total_amount  NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
  status        VARCHAR(32)    NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'pending_approval', 'archived')),
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotes_user_id ON quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_quotes_created_at ON quotes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
