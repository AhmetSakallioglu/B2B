import { readFileSync } from "fs";
import { join } from "path";
import pg from "pg";

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://postgres:5454@localhost:5432/cabinet_project",
});

try {
  await pool.query(
    readFileSync(join(process.cwd(), "db/tax-exemption-workflow-migration.sql"), "utf8")
  );
  console.log("Tax exemption workflow migration completed.");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Tax exemption workflow migration failed:", message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
