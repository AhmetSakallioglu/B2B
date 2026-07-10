-- =============================================================================
-- Cabinet Project — Full local setup (schema + seed)
-- Usage (psql):
--   psql -U postgres -d cabinet_project -f db/setup.sql
-- =============================================================================

\ir schema.sql
\ir seed.sql

SELECT
  (SELECT COUNT(*) FROM categories)        AS categories,
  (SELECT COUNT(*) FROM sub_categories)    AS sub_categories,
  (SELECT COUNT(*) FROM products)          AS products,
  (SELECT COUNT(*) FROM product_variants)  AS variants;
