-- Dynamic email templates + abandoned cart send log.

CREATE TABLE IF NOT EXISTS email_templates (
  id                 SERIAL PRIMARY KEY,
  name               VARCHAR(200) NOT NULL,
  subject            VARCHAR(500) NOT NULL,
  body_html          TEXT NOT NULL,
  is_system_default  BOOLEAN NOT NULL DEFAULT false,
  automation_stage   SMALLINT
                     CHECK (automation_stage IS NULL OR automation_stage BETWEEN 1 AND 3),
  cta_label          VARCHAR(120),
  cta_href           VARCHAR(500),
  sort_order         INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_templates_automation_stage
  ON email_templates(automation_stage)
  WHERE automation_stage IS NOT NULL;

CREATE TABLE IF NOT EXISTS abandoned_cart_email_log (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id      INTEGER REFERENCES email_templates(id) ON DELETE SET NULL,
  template_name    VARCHAR(200) NOT NULL,
  recipient_email  VARCHAR(255) NOT NULL,
  subject          VARCHAR(500) NOT NULL,
  send_type        VARCHAR(20) NOT NULL CHECK (send_type IN ('automated', 'manual')),
  sent_by          INTEGER REFERENCES users(id) ON DELETE SET NULL,
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_abandoned_cart_email_log_user_id
  ON abandoned_cart_email_log(user_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_abandoned_cart_email_log_sent_at
  ON abandoned_cart_email_log(sent_at DESC);
