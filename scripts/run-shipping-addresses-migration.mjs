import { readFileSync } from "fs";
import { join } from "path";
import pg from "pg";

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://postgres:5454@localhost:5432/cabinet_project",
});

try {
  const sql = readFileSync(
    join(process.cwd(), "db/shipping-addresses-migration.sql"),
    "utf8"
  );
  await pool.query(sql);
  console.log("Shipping addresses migration completed.");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Shipping addresses migration failed:", message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
