-- Restore catalog_products columns dropped by three-tier-gallery migration.

DROP VIEW IF EXISTS catalog_products;

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
JOIN door_finishes df ON df.id = pv.finish_id AND df.deleted_at IS NULL
JOIN products p       ON p.id = pv.product_id AND p.deleted_at IS NULL
JOIN sub_categories sc ON sc.id = p.sub_category_id
JOIN categories c     ON c.id = sc.category_id
WHERE pv.deleted_at IS NULL;
