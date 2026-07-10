-- Admin Web Push subscriptions (per admin user + browser endpoint).

CREATE TABLE IF NOT EXISTS admin_push_subscriptions (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint    TEXT         NOT NULL,
  p256dh      TEXT         NOT NULL,
  auth_secret TEXT         NOT NULL,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_admin_push_subscriptions_user_id
  ON admin_push_subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_admin_push_subscriptions_endpoint
  ON admin_push_subscriptions(endpoint);
