-- Smart B2B pop-up engine: targeting, frequency, priority, multi-campaign support.

ALTER TABLE announcement_popups
  DROP CONSTRAINT IF EXISTS announcement_popups_id_check;

ALTER TABLE announcement_popups
  ADD COLUMN IF NOT EXISTS name VARCHAR(120) NOT NULL DEFAULT 'Dealer announcement';

ALTER TABLE announcement_popups
  ADD COLUMN IF NOT EXISTS target_pages JSONB NOT NULL DEFAULT '["ALL"]'::jsonb;

ALTER TABLE announcement_popups
  ADD COLUMN IF NOT EXISTS frequency_type VARCHAR(20) NOT NULL DEFAULT 'ONCE';

ALTER TABLE announcement_popups
  ADD COLUMN IF NOT EXISTS max_views INTEGER NOT NULL DEFAULT 1;

ALTER TABLE announcement_popups
  ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 100;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'announcement_popups_frequency_type_check'
  ) THEN
    ALTER TABLE announcement_popups
      ADD CONSTRAINT announcement_popups_frequency_type_check
      CHECK (frequency_type IN ('ONCE', 'EVERY_SESSION', 'MAX_LIMIT'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'announcement_popups_max_views_check'
  ) THEN
    ALTER TABLE announcement_popups
      ADD CONSTRAINT announcement_popups_max_views_check
      CHECK (max_views >= 1 AND max_views <= 100);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_announcement_popups_active_priority
  ON announcement_popups (is_active, priority DESC, id ASC);

UPDATE announcement_popups
SET
  target_pages = COALESCE(target_pages, '["ALL"]'::jsonb),
  frequency_type = COALESCE(frequency_type, 'ONCE'),
  max_views = COALESCE(max_views, 1),
  priority = COALESCE(priority, 100)
WHERE id = 1;
