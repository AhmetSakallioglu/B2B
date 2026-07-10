-- Audit log + soft delete for products, product_variants, and door_finishes.

DO $$
BEGIN
  CREATE TYPE audit_action AS ENUM ('CREATE', 'UPDATE', 'SOFT_DELETE', 'RESTORE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE door_finishes
  ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS audit_logs (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action      audit_action NOT NULL,
  table_name  TEXT NOT NULL,
  record_id   INTEGER NOT NULL,
  old_values  JSONB,
  new_values  JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  restored_at TIMESTAMPTZ,
  restored_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_products_deleted_at ON products(deleted_at);
CREATE INDEX IF NOT EXISTS idx_product_variants_deleted_at ON product_variants(deleted_at);
CREATE INDEX IF NOT EXISTS idx_door_finishes_deleted_at ON door_finishes(deleted_at);

DROP VIEW IF EXISTS catalog_products;

CREATE OR REPLACE VIEW catalog_products AS
SELECT
  pv.id              AS variant_id,
  pv.sku             AS variant_sku,
  p.sku              AS product_sku,
  p.name             AS product_name,
  p.description,
  COALESCE(
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
  df.id              AS finish_id,
  df.slug            AS finish_slug,
  pv.stock_status,
  pv.price
FROM product_variants pv
JOIN door_finishes df ON df.id = pv.finish_id AND df.deleted_at IS NULL
JOIN products p       ON p.id = pv.product_id AND p.deleted_at IS NULL
JOIN sub_categories sc ON sc.id = p.sub_category_id
JOIN categories c     ON c.id = sc.category_id
WHERE pv.deleted_at IS NULL;
