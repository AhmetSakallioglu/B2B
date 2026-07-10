import { readFileSync } from "fs";
import { join } from "path";
import pg from "pg";

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://postgres:5454@localhost:5432/cabinet_project",
});

try {
  const sql = readFileSync(join(process.cwd(), "db/user-approval-migration.sql"), "utf8");
  await pool.query(sql);

  const admins = await pool.query(
    `
      UPDATE users
      SET
        account_status = 'approved',
        reviewed_at = COALESCE(reviewed_at, NOW())
      WHERE role = 'admin'
      RETURNING id, email, role, account_status
    `
  );

  console.log("User approval migration completed.");
  console.log("Approved admin account(s):", admins.rows);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("User approval migration failed:", message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
