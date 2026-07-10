ALTER TABLE users
  ADD COLUMN IF NOT EXISTS resale_license_number VARCHAR(100);
