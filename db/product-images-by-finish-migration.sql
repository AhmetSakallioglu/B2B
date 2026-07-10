-- Scope product images per door finish (product module + finish).

ALTER TABLE product_images
  ADD COLUMN IF NOT EXISTS finish_id INTEGER REFERENCES door_finishes(id);

DROP INDEX IF EXISTS idx_product_images_one_cover;

INSERT INTO product_images (product_id, finish_id, image_url, sort_order, is_cover)
SELECT pi.product_id, finishes.finish_id, pi.image_url, pi.sort_order, pi.is_cover
FROM product_images pi
JOIN (
  SELECT DISTINCT product_id, finish_id
  FROM product_variants
) finishes ON finishes.product_id = pi.product_id
WHERE pi.finish_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM product_images existing
    WHERE existing.product_id = pi.product_id
      AND existing.finish_id = finishes.finish_id
      AND existing.image_url = pi.image_url
  );

DELETE FROM product_images WHERE finish_id IS NULL;

ALTER TABLE product_images
  ALTER COLUMN finish_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_images_one_cover
  ON product_images(product_id, finish_id)
  WHERE is_cover = true;

CREATE INDEX IF NOT EXISTS idx_product_images_finish_id
  ON product_images(product_id, finish_id, sort_order, id);

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
JOIN door_finishes df ON df.id = pv.finish_id
JOIN products p       ON p.id = pv.product_id
JOIN sub_categories sc ON sc.id = p.sub_category_id
JOIN categories c     ON c.id = sc.category_id;
