-- Ensure door_finishes.is_active exists for older databases.

ALTER TABLE door_finishes
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_door_finishes_active_sort
  ON door_finishes(is_active, sort_order, name);
