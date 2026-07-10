-- Adds administrator approval workflow for customer accounts.
-- Safe to run multiple times.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_status') THEN
    CREATE TYPE account_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END $$;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_status account_status NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Existing customers and admins remain usable.
UPDATE users
SET account_status = 'approved'
WHERE account_status IS NULL OR account_status = 'approved';

UPDATE users
SET account_status = 'approved', reviewed_at = COALESCE(reviewed_at, created_at)
WHERE role = 'admin';

CREATE INDEX IF NOT EXISTS idx_users_account_status ON users(account_status);
CREATE INDEX IF NOT EXISTS idx_users_account_status_created_at ON users(account_status, created_at DESC);
