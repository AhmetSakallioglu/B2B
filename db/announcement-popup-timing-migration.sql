-- Timing and version tracking for dealer announcement popups.
ALTER TABLE announcement_popups
  ADD COLUMN IF NOT EXISTS display_delay INTEGER NOT NULL DEFAULT 3;

ALTER TABLE announcement_popups
  ADD COLUMN IF NOT EXISTS popup_version TEXT;

UPDATE announcement_popups
SET display_delay = COALESCE(display_delay, 3)
WHERE id = 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'announcement_popups_display_delay_check'
  ) THEN
    ALTER TABLE announcement_popups
      ADD CONSTRAINT announcement_popups_display_delay_check
      CHECK (display_delay >= 0 AND display_delay <= 120);
  END IF;
END $$;
