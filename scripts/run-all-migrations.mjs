import { readFileSync } from "fs";
import { join } from "path";
import pg from "pg";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://postgres:5454@localhost:5432/cabinet_project";

const root = process.cwd();

/**
 * Dependency-safe order for fresh schema.sql + incremental migrations.
 * db:auth is intentionally excluded (drops orders).
 */
const MIGRATION_FILES = [
  "db/user-profile-migration.sql",
  "db/user-approval-migration.sql",
  "db/user-deleted-status-migration.sql",
  "db/dealer-application-migration.sql",
  "db/dealer-tax-status-migration.sql",
  "db/customer-tiers-migration.sql",
  "db/door-finishes-migration.sql",
  "db/door-finishes-is-active-migration.sql",
  "db/product-images-cart-migration.sql",
  "db/product-images-by-finish-migration.sql",
  "db/audit-soft-delete-migration.sql",
  "db/soft-delete-sku-migration.sql",
  "db/three-tier-gallery-migration.sql",
  "db/catalog-products-view-fix-migration.sql",
  "db/catalog-bulk-status-migration.sql",
  "db/session-version-migration.sql",
  "db/admin-permissions-migration.sql",
  "db/user-management-permissions-migration.sql",
  "db/quotes-migration.sql",
  "db/quotes-permissions-migration.sql",
  "db/quotes-archive-migration.sql",
  "db/promo-codes-migration.sql",
  "db/promo-crud-migration.sql",
  "db/cart-applied-promo-migration.sql",
  "db/order-pricing-snapshot-migration.sql",
  "db/order-sales-tax-migration.sql",
  "db/order-modification-workflow-migration.sql",
  "db/shipping-zones-migration.sql",
  "db/shipping-addresses-migration.sql",
  "db/client-quotes-migration.sql",
  "db/client-quotes-status-migration.sql",
  "db/room-templates-migration.sql",
  "db/tax-exemption-workflow-migration.sql",
  "db/resale-license-number-migration.sql",
  "db/announcement-popup-migration.sql",
  "db/announcement-popup-timing-migration.sql",
  "db/announcement-popup-engine-migration.sql",
  "db/announcement-permissions-migration.sql",
  "db/abandoned-cart-migration.sql",
  "db/email-templates-migration.sql",
  "db/email-template-promo-migration.sql",
  "db/promo-expiry-days-migration.sql",
  "db/impersonation-migration.sql",
  "db/segmentation-automation-migration.sql",
  "db/email-campaigns-expansion-migration.sql",
  "db/push-subscriptions-migration.sql",
  "db/dealer-churn-radar-migration.sql",
];

function createPool() {
  if (connectionString.includes("-pooler")) {
    console.error(
      "ERROR: DATABASE_URL uses Neon pooler (-pooler).\n" +
        "Use the DIRECT connection string from Neon (host without -pooler).\n"
    );
    process.exit(1);
  }

  return new pg.Pool({ connectionString });
}

async function bootstrapPublicSchema(pool) {
  await pool.query("SET search_path TO public");
  const bootstrap = readFileSync(
    join(root, "db/neon-public-schema-bootstrap.sql"),
    "utf8"
  );
  await pool.query(bootstrap);
}

async function runSqlFile(pool, relativePath) {
  await pool.query("SET search_path TO public");
  const sql = readFileSync(join(root, relativePath), "utf8");
  await pool.query(sql);
  console.log(`OK ${relativePath}`);
}

async function ensureBaseSchema(pool) {
  const result = await pool.query(`
    SELECT to_regclass('public.products') IS NOT NULL AS has_products
  `);

  if (result.rows[0]?.has_products) {
    console.log("Base schema detected (products table exists).");
    return;
  }

  console.log("No base schema found — applying db/schema.sql ...");
  await runSqlFile(pool, "db/schema.sql");
}

async function ensureBootstrapAdmin(pool) {
  const result = await pool.query(`SELECT COUNT(*)::text AS count FROM users`);

  if (Number.parseInt(result.rows[0]?.count ?? "0", 10) > 0) {
    console.log("Users already exist — skipping auth seed.");
    return;
  }

  console.log("No users found — applying db/auth-seed.sql (admin@cabinet.local / admin123) ...");
  await runSqlFile(pool, "db/auth-seed.sql");
  console.log("Granting super-admin permissions to seeded admin ...");
  await runSqlFile(pool, "db/admin-permissions-migration.sql");
}

async function main() {
  console.log("Running additive migrations against DATABASE_URL ...");
  console.log("WARNING: db:auth is intentionally skipped (it drops orders).\n");

  const pool = createPool();

  try {
    await bootstrapPublicSchema(pool);
    console.log("OK db/neon-public-schema-bootstrap.sql");

    await ensureBaseSchema(pool);

    for (const file of MIGRATION_FILES) {
      console.log(`\n>> ${file}`);
      try {
        await runSqlFile(pool, file);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`\nFAILED ${file}`);
        console.error(message);
        console.error("\nFix the migration order or SQL, then re-run: npm run db:migrate-all");
        process.exitCode = 1;
        return;
      }
    }

    await ensureBootstrapAdmin(pool);

    console.log("\nAll migrations completed. Run: npm run db:check");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("\nMigration run failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
