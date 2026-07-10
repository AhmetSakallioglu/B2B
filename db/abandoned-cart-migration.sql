-- Abandoned cart recovery: per-user mail sequence + global automation settings.

CREATE TABLE IF NOT EXISTS abandoned_cart_settings (
  id                  INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  automation_enabled  BOOLEAN NOT NULL DEFAULT true,
  offer_code          VARCHAR(40) NOT NULL DEFAULT 'PROJECT5',
  offer_percent       NUMERIC(5, 2) NOT NULL DEFAULT 5,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO abandoned_cart_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS abandoned_cart_recovery (
  user_id               INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  abandoned_mail_status SMALLINT NOT NULL DEFAULT 0
                        CHECK (abandoned_mail_status >= 0 AND abandoned_mail_status <= 3),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_abandoned_cart_recovery_status
  ON abandoned_cart_recovery(abandoned_mail_status);

CREATE INDEX IF NOT EXISTS idx_cart_items_user_updated
  ON cart_items(user_id, updated_at DESC);
