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
    readFileSync(
      join(process.cwd(), "db/user-management-permissions-migration.sql"),
      "utf8"
    )
  );
  console.log("User management permissions migration completed.");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("User management permissions migration failed:", message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
