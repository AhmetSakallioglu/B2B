-- Three-tier relational gallery: product.images + door_finishes.finish_images + product_variants.variant_images

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS images TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE door_finishes
  ADD COLUMN IF NOT EXISTS finish_images TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS variant_images TEXT[];

-- Seed product-level images from legacy cover URL
UPDATE products
SET images = ARRAY[image_url]
WHERE image_url IS NOT NULL
  AND cardinality(images) = 0;

-- Aggregate per-finish gallery URLs from legacy product_images rows
UPDATE door_finishes df
SET finish_images = COALESCE(sub.urls, '{}')
FROM (
  SELECT
    pi.finish_id,
    array_agg(pi.image_url ORDER BY pi.min_sort, pi.min_id) AS urls
  FROM (
    SELECT
      finish_id,
      image_url,
      MIN(sort_order) AS min_sort,
      MIN(id) AS min_id
    FROM product_images
    GROUP BY finish_id, image_url
  ) pi
  GROUP BY pi.finish_id
) sub
WHERE df.id = sub.finish_id;

-- Prepend sample swatch when not already in finish_images
UPDATE door_finishes
SET finish_images = array_prepend(sample_image_url, finish_images)
WHERE sample_image_url IS NOT NULL
  AND NOT (sample_image_url = ANY(finish_images));

-- Sync legacy sample_image_url from first finish gallery image
UPDATE door_finishes
SET sample_image_url = finish_images[1]
WHERE cardinality(finish_images) > 0
  AND (sample_image_url IS NULL OR sample_image_url = '');

-- Sync legacy product cover from first product image
UPDATE products
SET image_url = images[1]
WHERE cardinality(images) > 0
  AND (image_url IS NULL OR image_url = '');

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
