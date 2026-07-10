import { readFileSync } from "fs";
import { join } from "path";
import pg from "pg";

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://postgres:5454@localhost:5432/cabinet_project",
});

async function tableExists(tableName) {
  const result = await pool.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = $1
      ) AS exists
    `,
    [tableName]
  );

  return result.rows[0]?.exists === true;
}

async function columnExists(tableName, columnName) {
  const result = await pool.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name = $2
      ) AS exists
    `,
    [tableName, columnName]
  );

  return result.rows[0]?.exists === true;
}

try {
  if (!(await tableExists("group_promo_rates"))) {
    const segmentationSql = readFileSync(
      join(process.cwd(), "db/segmentation-automation-migration.sql"),
      "utf8"
    );
    await pool.query(segmentationSql);
    console.log("Segmentation & automation migration completed (dependency).");
  }

  if (!(await columnExists("admin_permissions", "can_manage_coupons"))) {
    const sql = readFileSync(
      join(process.cwd(), "db/email-campaigns-expansion-migration.sql"),
      "utf8"
    );
    await pool.query(sql);
    console.log("Email campaigns expansion migration completed.");
  }

  if (!(await columnExists("email_templates", "issue_promo_on_send"))) {
    const promoSql = readFileSync(
      join(process.cwd(), "db/email-template-promo-migration.sql"),
      "utf8"
    );
    await pool.query(promoSql);
    console.log("Email template promo migration completed.");
  }

  if (!(await columnExists("abandoned_cart_settings", "promo_expiry_days"))) {
    const expirySql = readFileSync(
      join(process.cwd(), "db/promo-expiry-days-migration.sql"),
      "utf8"
    );
    await pool.query(expirySql);
    console.log("Promo expiry days migration completed.");
  }

  if (!(await columnExists("promo_codes", "is_active"))) {
    const crudSql = readFileSync(
      join(process.cwd(), "db/promo-crud-migration.sql"),
      "utf8"
    );
    await pool.query(crudSql);
    console.log("Promo CRUD migration completed.");
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Email campaigns expansion migration failed:", message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
