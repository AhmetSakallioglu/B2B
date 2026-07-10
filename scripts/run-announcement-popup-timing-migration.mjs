import { readFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import pg from "pg";

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://postgres:5454@localhost:5432/cabinet_project",
});

try {
  const sql = readFileSync(
    join(process.cwd(), "db/announcement-popup-timing-migration.sql"),
    "utf8"
  );
  await pool.query(sql);

  await pool.query(
    `
      UPDATE announcement_popups
      SET popup_version = $1
      WHERE id = 1 AND (popup_version IS NULL OR popup_version = '')
    `,
    [randomUUID()]
  );

  await pool.query(`
    ALTER TABLE announcement_popups
      ALTER COLUMN popup_version SET NOT NULL
  `);

  console.log("Announcement popup timing migration completed.");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Announcement popup timing migration failed:", message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
