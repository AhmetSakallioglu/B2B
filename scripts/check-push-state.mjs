import pg from "pg";

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://postgres:5454@localhost:5432/cabinet_project",
});

try {
  const subs = await pool.query(
    "SELECT COUNT(*)::int AS count FROM admin_push_subscriptions"
  );
  const admins = await pool.query(`
    SELECT u.id, u.email, ap.is_super_admin, ap.can_approve_users, ap.can_view_orders
    FROM users u
    LEFT JOIN admin_permissions ap ON ap.user_id = u.id
    WHERE u.role = 'admin'
  `);
  const rows = await pool.query(
    "SELECT id, user_id, left(endpoint, 100) AS endpoint FROM admin_push_subscriptions"
  );
  console.log(JSON.stringify({ subs: subs.rows[0], admins: admins.rows, rows: rows.rows }, null, 2));
} finally {
  await pool.end();
}
