-- =============================================================================
-- Cabinet Project — Seed Data
-- Run AFTER schema.sql on the same database.
-- Safe to re-run: truncates catalog tables and reloads sample data.
-- =============================================================================

BEGIN;

TRUNCATE TABLE
  product_variants,
  products,
  sub_categories,
  categories,
  door_finishes
RESTART IDENTITY CASCADE;

-- ---------------------------------------------------------------------------
-- 1. Main categories
-- ---------------------------------------------------------------------------
INSERT INTO categories (name, slug) VALUES
  ('Kitchen Cabinet',  'kitchen-cabinet'),
  ('Bathroom Cabinet', 'bathroom-cabinet');

-- ---------------------------------------------------------------------------
-- 2. Sub categories
-- ---------------------------------------------------------------------------
INSERT INTO sub_categories (category_id, name, slug)
SELECT c.id, v.name, v.slug
FROM categories c
JOIN (
  VALUES
    ('kitchen-cabinet',  'Base Cabinet',         'base-cabinet'),
    ('kitchen-cabinet',  'Wall Cabinet',         'wall-cabinet'),
    ('kitchen-cabinet',  'Tall/Pantry Cabinet',  'tall-pantry-cabinet'),
    ('bathroom-cabinet', 'Base Cabinet',         'base-cabinet'),
    ('bathroom-cabinet', 'Wall Cabinet',         'wall-cabinet')
) AS v(category_slug, name, slug) ON c.slug = v.category_slug;

-- ---------------------------------------------------------------------------
-- 3. Door / finishes
-- ---------------------------------------------------------------------------
INSERT INTO door_finishes (name, slug, description, sort_order) VALUES
  ('White Shaker', 'white-shaker', 'Classic white shaker door style', 1),
  ('Grey Shaker',  'grey-shaker',  'Soft grey shaker door style', 2),
  ('Espresso',     'espresso',     'Dark espresso finish', 3);

-- ---------------------------------------------------------------------------
-- 4. Product modules (SKU: B12, W2430, TP1890, BV24, ...)
-- ---------------------------------------------------------------------------
INSERT INTO products (sub_category_id, sku, name, description, image_url)
SELECT sc.id, v.sku, v.name, v.description, v.image_url
FROM (
  VALUES
    (
      'kitchen-cabinet', 'base-cabinet',
      'B12',
      'Base Cabinet B12',
      'Single-door base cabinet with soft-close hinges and an adjustable shelf.',
      'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=800&q=80'
    ),
    (
      'kitchen-cabinet', 'base-cabinet',
      'B15',
      'Base Cabinet B15',
      '15-inch wide drawer base module for narrow spaces.',
      'https://images.unsplash.com/photo-1560184897-ae75e788474b?auto=format&fit=crop&w=800&q=80'
    ),
    (
      'kitchen-cabinet', 'base-cabinet',
      'B18',
      'Base Cabinet B18',
      '18-inch double-drawer base cabinet with full-extension slide system.',
      'https://images.unsplash.com/photo-1616486338812-3adaada4b4d9?auto=format&fit=crop&w=800&q=80'
    ),
    (
      'kitchen-cabinet', 'base-cabinet',
      'B21',
      'Base Cabinet B21',
      '21-inch base cabinet with generous storage, trash pull-out compatible.',
      'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=800&q=80'
    ),
    (
      'kitchen-cabinet', 'wall-cabinet',
      'W2430',
      'Wall Cabinet W2430',
      '24x30 inch wall cabinet with a panel ready for glass door options.',
      'https://images.unsplash.com/photo-1560184897-ae75e788474b?auto=format&fit=crop&w=800&q=80'
    ),
    (
      'kitchen-cabinet', 'wall-cabinet',
      'W3030',
      'Wall Cabinet W3030',
      '30-inch wide upper cabinet with integrated LED lighting channel.',
      'https://images.unsplash.com/photo-1616486338812-3adaada4b4d9?auto=format&fit=crop&w=800&q=80'
    ),
    (
      'kitchen-cabinet', 'tall-pantry-cabinet',
      'TP1890',
      'Tall Pantry TP1890',
      '90-inch tall pantry cabinet with lazy Susan and interior organizers.',
      'https://images.unsplash.com/photo-1595428774223-ef52624120aa?auto=format&fit=crop&w=800&q=80'
    ),
    (
      'bathroom-cabinet', 'base-cabinet',
      'BV24',
      'Bathroom Vanity BV24',
      '24-inch bathroom vanity base with water-resistant melamine surface.',
      'https://images.unsplash.com/photo-1620626011761-996317b8d101?auto=format&fit=crop&w=800&q=80'
    )
) AS v(category_slug, sub_category_slug, sku, name, description, image_url)
JOIN categories c ON c.slug = v.category_slug
JOIN sub_categories sc ON sc.category_id = c.id AND sc.slug = v.sub_category_slug;

-- ---------------------------------------------------------------------------
-- 5. Product variants (W × H × D, finish, stock, price)
-- ---------------------------------------------------------------------------
INSERT INTO product_variants (
  product_id,
  finish_id,
  width_in,
  height_in,
  depth_in,
  stock_status,
  price,
  sku
)
SELECT
  p.id,
  df.id,
  v.width_in,
  v.height_in,
  v.depth_in,
  v.stock_status::stock_status,
  v.price,
  v.variant_sku
FROM (
  VALUES
    ('B12',   'White Shaker', 12.00, 34.50, 24.00, 'in_stock',     289.00, 'B12-WS-12-34.5-24'),
    ('B15',   'Grey Shaker',  15.00, 34.50, 24.00, 'in_stock',     319.00, 'B15-GS-15-34.5-24'),
    ('B18',   'Espresso',     18.00, 34.50, 24.00, 'out_of_stock', 349.00, 'B18-ES-18-34.5-24'),
    ('B21',   'White Shaker', 21.00, 34.50, 24.00, 'in_stock',     379.00, 'B21-WS-21-34.5-24'),
    ('W2430', 'White Shaker', 24.00, 30.00, 12.00, 'in_stock',     249.00, 'W2430-WS-24-30-12'),
    ('W3030', 'Grey Shaker',  30.00, 30.00, 12.00, 'in_stock',     279.00, 'W3030-GS-30-30-12'),
    ('TP1890','Espresso',     18.00, 90.00, 24.00, 'in_stock',     899.00, 'TP1890-ES-18-90-24'),
    ('BV24',  'White Shaker', 24.00, 34.50, 21.00, 'out_of_stock', 429.00, 'BV24-WS-24-34.5-21')
) AS v(product_sku, finish_name, width_in, height_in, depth_in, stock_status, price, variant_sku)
JOIN products p ON p.sku = v.product_sku
JOIN door_finishes df ON df.name = v.finish_name;

COMMIT;

-- Quick sanity check (optional — comment out if running inside pgAdmin as part of a script)
-- SELECT category, sub_category, product_sku, variant_sku, width_in, height_in, depth_in, color, stock_status, price
-- FROM catalog_products
-- ORDER BY category, sub_category, product_sku;
