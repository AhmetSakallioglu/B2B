-- =============================================================================
-- Cabinet Project — PostgreSQL Schema
-- Run this file FIRST on an empty database (before seed.sql).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE stock_status AS ENUM ('in_stock', 'out_of_stock');

CREATE TABLE categories (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  slug        VARCHAR(100) NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE sub_categories (
  id          SERIAL PRIMARY KEY,
  category_id INTEGER      NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(100) NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (category_id, slug)
);

CREATE TABLE products (
  id               SERIAL PRIMARY KEY,
  sub_category_id  INTEGER      NOT NULL REFERENCES sub_categories(id) ON DELETE CASCADE,
  sku              VARCHAR(20)  NOT NULL UNIQUE,
  name             VARCHAR(150) NOT NULL,
  description      TEXT,
  image_url        TEXT,
  images           TEXT[]       NOT NULL DEFAULT '{}',
  is_listed        BOOLEAN      NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE door_finishes (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(100) NOT NULL UNIQUE,
  slug             VARCHAR(100) NOT NULL UNIQUE,
  description      TEXT,
  sample_image_url TEXT,
  finish_images    TEXT[]       NOT NULL DEFAULT '{}',
  sort_order       INTEGER      NOT NULL DEFAULT 0,
  is_active        BOOLEAN      NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE product_variants (
  id             SERIAL PRIMARY KEY,
  product_id     INTEGER        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  finish_id      INTEGER        NOT NULL REFERENCES door_finishes(id) ON DELETE RESTRICT,
  width_in       NUMERIC(6, 2)  NOT NULL,
  height_in      NUMERIC(6, 2)  NOT NULL,
  depth_in       NUMERIC(6, 2)  NOT NULL,
  stock_status   stock_status   NOT NULL DEFAULT 'in_stock',
  price          NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  sku            VARCHAR(80)    NOT NULL UNIQUE,
  variant_images TEXT[],
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, width_in, height_in, depth_in, finish_id)
);

CREATE INDEX idx_sub_categories_category_id ON sub_categories(category_id);
CREATE INDEX idx_products_sub_category_id ON products(sub_category_id);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX idx_product_variants_dimensions ON product_variants(width_in, height_in, depth_in);
CREATE INDEX idx_product_variants_finish_id ON product_variants(finish_id);
CREATE INDEX idx_door_finishes_slug ON door_finishes(slug);
CREATE INDEX idx_door_finishes_active_sort ON door_finishes(is_active, sort_order, name);
CREATE INDEX idx_product_variants_stock_status ON product_variants(stock_status);

CREATE TABLE product_images (
  id         SERIAL PRIMARY KEY,
  product_id INTEGER      NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  finish_id  INTEGER      NOT NULL REFERENCES door_finishes(id) ON DELETE CASCADE,
  image_url  TEXT         NOT NULL,
  sort_order INTEGER      NOT NULL DEFAULT 0,
  is_cover   BOOLEAN      NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_product_images_product_id ON product_images(product_id, finish_id, sort_order, id);
CREATE UNIQUE INDEX idx_product_images_one_cover ON product_images(product_id, finish_id) WHERE is_cover = true;

-- Convenience view: flattened catalog row (matches frontend filter fields)
CREATE OR REPLACE VIEW catalog_products AS
SELECT
  p.id               AS product_id,
  pv.id              AS variant_id,
  pv.sku             AS variant_sku,
  p.sku              AS product_sku,
  p.name             AS product_name,
  p.description,
  p.is_listed,
  COALESCE(
    p.images[1],
    pv.variant_images[1],
    df.finish_images[1],
    (
      SELECT pi.image_url
      FROM product_images pi
      WHERE pi.product_id = p.id
        AND pi.finish_id = pv.finish_id
        AND pi.is_cover = true
      LIMIT 1
    ),
    (
      SELECT pi.image_url
      FROM product_images pi
      WHERE pi.product_id = p.id
        AND pi.finish_id = pv.finish_id
      ORDER BY pi.sort_order ASC, pi.id ASC
      LIMIT 1
    ),
    p.image_url
  )                  AS image_url,
  c.name             AS category,
  c.slug             AS category_slug,
  sc.name            AS sub_category,
  sc.slug            AS sub_category_slug,
  pv.width_in,
  pv.height_in,
  pv.depth_in,
  df.name            AS color,
  df.name            AS finish_name,
  df.id              AS finish_id,
  df.slug            AS finish_slug,
  pv.stock_status,
  pv.price
FROM product_variants pv
JOIN door_finishes df ON df.id = pv.finish_id
JOIN products p       ON p.id = pv.product_id
JOIN sub_categories sc ON sc.id = p.sub_category_id
JOIN categories c     ON c.id = sc.category_id;

-- Users & authentication
CREATE TYPE user_role AS ENUM ('customer', 'admin');
CREATE TYPE account_status AS ENUM ('pending', 'approved', 'rejected', 'deleted');
CREATE TYPE dealer_tax_status AS ENUM ('taxable', 'exempt');

CREATE TABLE customer_tiers (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(100) NOT NULL,
  level            INTEGER      NOT NULL UNIQUE CHECK (level > 0),
  discount_percent NUMERIC(5, 2) NOT NULL CHECK (discount_percent >= 0 AND discount_percent <= 100),
  description      TEXT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
  id             SERIAL PRIMARY KEY,
  email          VARCHAR(255) NOT NULL UNIQUE,
  password_hash  TEXT         NOT NULL,
  role           user_role       NOT NULL DEFAULT 'customer',
  account_status account_status  NOT NULL DEFAULT 'pending',
  reviewed_at    TIMESTAMPTZ,
  reviewed_by    INTEGER         REFERENCES users(id) ON DELETE SET NULL,
  tier_id        INTEGER      REFERENCES customer_tiers(id) ON DELETE SET NULL,
  group_tag      VARCHAR(50)  NOT NULL DEFAULT 'New',
  company_name   VARCHAR(150),
  contact_name   VARCHAR(150),
  phone          VARCHAR(50),
  address_line1  VARCHAR(255),
  address_line2  VARCHAR(255),
  city           VARCHAR(100),
  state          VARCHAR(100),
  postal_code    VARCHAR(30),
  country        VARCHAR(100) DEFAULT 'United States',
  alternate_phone VARCHAR(50),
  fax            VARCHAR(50),
  billing_first_name VARCHAR(100),
  billing_last_name VARCHAR(100),
  billing_phone  VARCHAR(50),
  shipping_first_name VARCHAR(100),
  shipping_last_name VARCHAR(100),
  shipping_address_line1 VARCHAR(255),
  shipping_address_line2 VARCHAR(255),
  shipping_city  VARCHAR(100),
  shipping_state VARCHAR(100),
  shipping_postal_code VARCHAR(30),
  shipping_country VARCHAR(100) DEFAULT 'United States',
  shipping_phone VARCHAR(50),
  shipping_same_as_billing BOOLEAN NOT NULL DEFAULT false,
  federal_tax_id VARCHAR(20),
  application_notes TEXT,
  tax_status dealer_tax_status NOT NULL DEFAULT 'taxable',
  business_type VARCHAR(50),
  expected_monthly_sales VARCHAR(50),
  sales_tax_account VARCHAR(100),
  has_resale_license BOOLEAN,
  resale_license_number VARCHAR(100),
  tax_document_url TEXT,
  session_version INTEGER     NOT NULL DEFAULT 1,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Orders & line items
CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'completed');

CREATE TABLE cart_items (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  variant_id INTEGER      NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity   INTEGER      NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, variant_id)
);

CREATE INDEX idx_cart_items_user_id ON cart_items(user_id);
CREATE INDEX idx_cart_items_updated_at ON cart_items(updated_at DESC);
CREATE INDEX idx_cart_items_user_updated ON cart_items(user_id, updated_at DESC);

CREATE TABLE abandoned_cart_settings (
  id                  INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  automation_enabled  BOOLEAN NOT NULL DEFAULT true,
  offer_code          VARCHAR(40) NOT NULL DEFAULT 'PROJECT5',
  offer_percent       NUMERIC(5, 2) NOT NULL DEFAULT 5,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE abandoned_cart_recovery (
  user_id               INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  abandoned_mail_status SMALLINT NOT NULL DEFAULT 0
                        CHECK (abandoned_mail_status >= 0 AND abandoned_mail_status <= 3),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_abandoned_cart_recovery_status
  ON abandoned_cart_recovery(abandoned_mail_status);

CREATE TABLE automation_settings (
  id                    SERIAL PRIMARY KEY,
  step_number           SMALLINT NOT NULL UNIQUE CHECK (step_number BETWEEN 1 AND 3),
  is_active             BOOLEAN NOT NULL DEFAULT true,
  target_group          VARCHAR(50) NOT NULL DEFAULT 'All',
  discount_percentage   NUMERIC(5, 2) NOT NULL DEFAULT 5 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE group_promo_rates (
  group_tag             VARCHAR(50) PRIMARY KEY,
  discount_percentage   NUMERIC(5, 2) NOT NULL DEFAULT 5 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE email_templates (
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

CREATE UNIQUE INDEX idx_email_templates_automation_stage
  ON email_templates(automation_stage)
  WHERE automation_stage IS NOT NULL;

CREATE TABLE abandoned_cart_email_log (
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

CREATE INDEX idx_abandoned_cart_email_log_user_id
  ON abandoned_cart_email_log(user_id, sent_at DESC);

CREATE INDEX idx_abandoned_cart_email_log_sent_at
  ON abandoned_cart_email_log(sent_at DESC);

CREATE TABLE shipping_settings (
  id                       INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  default_out_of_zone_rate NUMERIC(10, 2) NOT NULL DEFAULT 500 CHECK (default_out_of_zone_rate >= 0),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE shipping_zones (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_name               VARCHAR(200) NOT NULL,
  base_price              NUMERIC(10, 2) NOT NULL CHECK (base_price >= 0),
  zip_codes               TEXT[] NOT NULL CHECK (cardinality(zip_codes) > 0),
  free_shipping_threshold NUMERIC(10, 2) CHECK (free_shipping_threshold IS NULL OR free_shipping_threshold >= 0),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shipping_zones_zip_codes ON shipping_zones USING GIN (zip_codes);

CREATE TABLE shipping_addresses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  address_title   VARCHAR(150) NOT NULL,
  street_address  VARCHAR(255) NOT NULL,
  city            VARCHAR(100) NOT NULL,
  state           VARCHAR(50) NOT NULL DEFAULT 'TX',
  zip_code        VARCHAR(20) NOT NULL,
  contact_person  VARCHAR(150),
  contact_phone   VARCHAR(50),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shipping_addresses_user_id ON shipping_addresses(user_id);

CREATE TABLE orders (
  id                   SERIAL PRIMARY KEY,
  user_id              INTEGER        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_price          NUMERIC(10, 2) NOT NULL CHECK (total_price >= 0),
  status               order_status   NOT NULL DEFAULT 'pending',
  placed_by_admin_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  subtotal             NUMERIC(10, 2),
  promo_discount       NUMERIC(10, 2) NOT NULL DEFAULT 0,
  msrp_subtotal        NUMERIC(10, 2),
  tier_name            VARCHAR(100),
  tier_discount_percent NUMERIC(5, 2),
  tier_discount_amount NUMERIC(10, 2),
  tax_rate NUMERIC(6, 4) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  shipping_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  shipping_zone_id UUID REFERENCES shipping_zones(id) ON DELETE SET NULL,
  shipping_zone_name VARCHAR(200),
  shipping_postal_code VARCHAR(20),
  shipping_address_id UUID REFERENCES shipping_addresses(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE promo_codes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(32) NOT NULL UNIQUE,
  discount_type   VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value  NUMERIC(10, 2) NOT NULL CHECK (discount_value > 0),
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creation_type   VARCHAR(20) NOT NULL DEFAULT 'AUTOMATIC'
                  CHECK (creation_type IN ('AUTOMATIC', 'MANUAL')),
  is_used         BOOLEAN NOT NULL DEFAULT false,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  expires_at      TIMESTAMPTZ NOT NULL,
  used_at         TIMESTAMPTZ,
  order_id        INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE orders
  ADD COLUMN promo_code_id UUID REFERENCES promo_codes(id) ON DELETE SET NULL;

CREATE INDEX idx_promo_codes_user_id ON promo_codes(user_id);
CREATE INDEX idx_promo_codes_code_upper ON promo_codes(UPPER(code));
CREATE INDEX idx_promo_codes_active_user
  ON promo_codes(user_id, is_used, expires_at DESC);

CREATE TABLE cart_applied_promos (
  user_id           INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  promo_code_id     UUID NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  code              VARCHAR(32) NOT NULL,
  promo_discount    NUMERIC(10, 2) NOT NULL DEFAULT 0,
  subtotal_at_apply NUMERIC(10, 2) NOT NULL DEFAULT 0,
  applied_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cart_applied_promos_code_upper
  ON cart_applied_promos(user_id, UPPER(code));

CREATE TABLE order_items (
  id         SERIAL PRIMARY KEY,
  order_id   INTEGER        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  variant_id INTEGER        NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  quantity   INTEGER        NOT NULL CHECK (quantity > 0),
  price      NUMERIC(10, 2) NOT NULL CHECK (price >= 0)
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_group_tag ON users(group_tag);
CREATE INDEX idx_users_account_status ON users(account_status);
CREATE INDEX idx_users_account_status_created_at ON users(account_status, created_at DESC);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_placed_by_admin_id ON orders(placed_by_admin_id) WHERE placed_by_admin_id IS NOT NULL;
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_variant_id ON order_items(variant_id);
