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
    readFileSync(join(process.cwd(), "db/dealer-churn-radar-migration.sql"), "utf8")
  );
  console.log("Dealer churn radar migration completed.");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Dealer churn radar migration failed:", message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
