import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import pg from "pg";

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://postgres:5454@localhost:5432/cabinet_project",
});

const root = process.cwd();

async function runSqlFile(relativePath) {
  const sql = readFileSync(join(root, relativePath), "utf8");
  await pool.query(sql);
}

try {
  await runSqlFile("db/auth-migration.sql");
  await runSqlFile("db/auth-seed.sql");

  const check = await pool.query(
    "SELECT id, email, role FROM users WHERE email = $1",
    ["admin@cabinet.local"]
  );

  writeFileSync(
    "db-test-out.txt",
    JSON.stringify(
      {
        success: true,
        adminUser: check.rows[0] ?? null,
      },
      null,
      2
    )
  );

  console.log("Auth migration and seed completed.");
  console.log("Admin user:", check.rows[0]);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  writeFileSync("db-test-out.txt", JSON.stringify({ error: message }, null, 2));
  console.error("Migration failed:", message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
