CREATE TABLE IF NOT EXISTS room_templates (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        INTEGER        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_name  VARCHAR(150)   NOT NULL,
  items          JSONB          NOT NULL,
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_room_templates_user_id
  ON room_templates (user_id);

CREATE INDEX IF NOT EXISTS idx_room_templates_user_created
  ON room_templates (user_id, created_at DESC);
