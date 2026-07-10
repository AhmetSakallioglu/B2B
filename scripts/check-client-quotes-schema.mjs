import pg from "pg";

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://postgres:5454@localhost:5432/cabinet_project",
});

try {
  const columns = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'users'
      AND column_name IN ('company_logo_url', 'custom_quote_footer_text')
  `);
  const table = await pool.query(`SELECT to_regclass('public.client_quotes') AS name`);
  console.log("branding columns:", columns.rows);
  console.log("client_quotes table:", table.rows[0]?.name ?? "MISSING");
} finally {
  await pool.end();
}
