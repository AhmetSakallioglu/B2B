-- Door / finish catalog entries managed by admin.
-- Legacy path: migrate product_variants.color -> finish_id when color column exists.
-- Fresh installs (schema.sql): finish_id already exists; color steps are skipped.

CREATE TABLE IF NOT EXISTS door_finishes (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(100) NOT NULL UNIQUE,
  slug             VARCHAR(100) NOT NULL UNIQUE,
  description      TEXT,
  sample_image_url TEXT,
  sort_order       INTEGER      NOT NULL DEFAULT 0,
  is_active        BOOLEAN      NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'product_variants'
      AND column_name = 'color'
  ) THEN
    INSERT INTO door_finishes (name, slug, description, sort_order)
    SELECT DISTINCT
      pv.color,
      lower(
        regexp_replace(
          regexp_replace(trim(pv.color), '[^a-zA-Z0-9]+', '-', 'g'),
          '(^-+|-+$)',
          '',
          'g'
        )
      ),
      NULL,
      ROW_NUMBER() OVER (ORDER BY pv.color)::integer
    FROM product_variants pv
    WHERE pv.color IS NOT NULL
    ON CONFLICT (name) DO NOTHING;

    ALTER TABLE product_variants
      ADD COLUMN IF NOT EXISTS finish_id INTEGER REFERENCES door_finishes(id);

    UPDATE product_variants pv
    SET finish_id = df.id
    FROM door_finishes df
    WHERE pv.finish_id IS NULL
      AND pv.color IS NOT NULL
      AND df.name = pv.color;

    ALTER TABLE product_variants DROP CONSTRAINT IF EXISTS product_variants_product_id_width_in_height_in_depth_in_color_key;

    ALTER TABLE product_variants
      DROP COLUMN IF EXISTS color;

    ALTER TABLE product_variants
      ALTER COLUMN finish_id SET NOT NULL;

    ALTER TABLE product_variants
      DROP CONSTRAINT IF EXISTS product_variants_product_id_width_in_height_in_depth_in_finish_id_key;

    ALTER TABLE product_variants
      ADD CONSTRAINT product_variants_product_id_width_in_height_in_depth_in_finish_id_key
      UNIQUE (product_id, width_in, height_in, depth_in, finish_id);
  END IF;
END $$;

DROP INDEX IF EXISTS idx_product_variants_color;
CREATE INDEX IF NOT EXISTS idx_product_variants_finish_id ON product_variants(finish_id);
CREATE INDEX IF NOT EXISTS idx_door_finishes_slug ON door_finishes(slug);
CREATE INDEX IF NOT EXISTS idx_door_finishes_active_sort ON door_finishes(is_active, sort_order, name);

-- View refresh only when legacy migration ran or view is missing expected columns.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'product_variants'
      AND column_name = 'color'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.views
    WHERE table_schema = 'public'
      AND table_name = 'catalog_products'
  ) THEN
    DROP VIEW IF EXISTS catalog_products;

    CREATE OR REPLACE VIEW catalog_products AS
    SELECT
      pv.id              AS variant_id,
      pv.sku             AS variant_sku,
      p.sku              AS product_sku,
      p.name             AS product_name,
      p.description,
      p.image_url,
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
  END IF;
END $$;
