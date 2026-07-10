-- Global dealer announcement popup (singleton row).
CREATE TABLE IF NOT EXISTS announcement_popups (
  id            INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  is_active     BOOLEAN NOT NULL DEFAULT false,
  display_mode  VARCHAR(20) NOT NULL DEFAULT 'template'
                CHECK (display_mode IN ('media', 'template')),
  media_url     TEXT,
  template_html TEXT,
  display_delay INTEGER NOT NULL DEFAULT 3
                CHECK (display_delay >= 0 AND display_delay <= 120),
  popup_version TEXT NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO announcement_popups (id, is_active, display_mode, popup_version)
VALUES (1, false, 'template', md5(random()::text || clock_timestamp()::text))
ON CONFLICT (id) DO NOTHING;
