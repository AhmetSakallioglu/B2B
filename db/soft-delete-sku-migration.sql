-- Release soft-deleted SKUs and enforce uniqueness only among active rows.

DROP VIEW IF EXISTS catalog_products;

ALTER TABLE products
  ALTER COLUMN sku TYPE VARCHAR(100);

ALTER TABLE product_variants
  ALTER COLUMN sku TYPE VARCHAR(120);

UPDATE products
SET sku = sku || '_deleted_' || FLOOR(EXTRACT(EPOCH FROM deleted_at))::bigint
WHERE deleted_at IS NOT NULL
  AND sku NOT LIKE '%\_deleted\_%' ESCAPE '\';

UPDATE product_variants
SET sku = sku || '_deleted_' || FLOOR(EXTRACT(EPOCH FROM deleted_at))::bigint
WHERE deleted_at IS NOT NULL
  AND sku NOT LIKE '%\_deleted\_%' ESCAPE '\';

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_sku_key;

ALTER TABLE product_variants
  DROP CONSTRAINT IF EXISTS product_variants_sku_key;

ALTER TABLE product_variants
  DROP CONSTRAINT IF EXISTS product_variants_product_id_width_in_height_in_depth_in_finish_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS unique_active_product_sku
  ON products (sku)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS unique_active_variant_sku
  ON product_variants (sku)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS unique_active_variant_dimensions
  ON product_variants (product_id, width_in, height_in, depth_in, finish_id)
  WHERE deleted_at IS NULL;

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
