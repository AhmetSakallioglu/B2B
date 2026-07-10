-- Product gallery images and persistent user carts.

CREATE TABLE IF NOT EXISTS product_images (
  id         SERIAL PRIMARY KEY,
  product_id INTEGER      NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url  TEXT         NOT NULL,
  sort_order INTEGER      NOT NULL DEFAULT 0,
  is_cover   BOOLEAN      NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id
  ON product_images(product_id, sort_order, id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_images_one_cover
  ON product_images(product_id)
  WHERE is_cover = true;

INSERT INTO product_images (product_id, image_url, sort_order, is_cover)
SELECT p.id, p.image_url, 0, true
FROM products p
WHERE p.image_url IS NOT NULL
  AND trim(p.image_url) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM product_images pi WHERE pi.product_id = p.id
  );

CREATE TABLE IF NOT EXISTS cart_items (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  variant_id INTEGER      NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity   INTEGER      NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, variant_id)
);

CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_updated_at ON cart_items(updated_at DESC);

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
      WHERE pi.product_id = p.id AND pi.is_cover = true
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
