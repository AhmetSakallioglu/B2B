import pg from "pg";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://postgres:5454@localhost:5432/cabinet_project";

const REQUIRED_TABLES = [
  "users",
  "orders",
  "order_items",
  "products",
  "product_variants",
  "door_finishes",
  "admin_permissions",
  "announcement_popups",
  "cart_items",
  "automation_settings",
  "abandoned_cart_settings",
  "customer_tiers",
  "promo_codes",
];

const REQUIRED_VIEWS = ["catalog_products"];

const REQUIRED_COLUMNS = {
  admin_permissions: ["can_manage_announcements", "can_view_orders", "can_view_products"],
  announcement_popups: [
    "name",
    "display_mode",
    "target_pages",
    "frequency_type",
    "max_views",
    "priority",
  ],
  orders: [
    "subtotal",
    "promo_code_id",
    "pending_modification",
    "modification_balance_due",
    "msrp_subtotal",
    "tax_amount",
    "shipping_amount",
  ],
};

if (connectionString.includes("-pooler")) {
  console.warn(
    "WARNING: DATABASE_URL uses Neon pooler. Prefer DIRECT connection (no -pooler) for schema checks.\n"
  );
}

const pool = new pg.Pool({ connectionString });

function printHeader(title) {
  console.log(`\n=== ${title} ===`);
}

try {
  printHeader("Connection");
  await pool.query("SET search_path TO public");
  const ping = await pool.query("SELECT current_database() AS db, version()");
  console.log(`Database: ${ping.rows[0].db}`);
  console.log(`OK: connected`);

  printHeader("Tables");
  const tables = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `);
  const tableSet = new Set(tables.rows.map((row) => row.table_name));
  let issues = 0;

  for (const table of REQUIRED_TABLES) {
    if (tableSet.has(table)) {
      console.log(`OK   ${table}`);
    } else {
      console.log(`MISS ${table}`);
      issues += 1;
    }
  }

  printHeader("Views");
  const views = await pool.query(`
    SELECT table_name
    FROM information_schema.views
    WHERE table_schema = 'public'
  `);
  const viewSet = new Set(views.rows.map((row) => row.table_name));

  for (const view of REQUIRED_VIEWS) {
    if (viewSet.has(view)) {
      console.log(`OK   ${view}`);
    } else {
      console.log(`MISS ${view}`);
      issues += 1;
    }
  }

  printHeader("Columns");
  for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
    if (!tableSet.has(table)) {
      console.log(`SKIP ${table} (table missing)`);
      continue;
    }

    const result = await pool.query(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
      `,
      [table]
    );
    const columnSet = new Set(result.rows.map((row) => row.column_name));

    for (const column of columns) {
      if (columnSet.has(column)) {
        console.log(`OK   ${table}.${column}`);
      } else {
        console.log(`MISS ${table}.${column}`);
        issues += 1;
      }
    }
  }

  printHeader("Sample counts");
  for (const table of ["users", "orders", "products", "announcement_popups"]) {
    if (!tableSet.has(table)) {
      continue;
    }

    const count = await pool.query(`SELECT COUNT(*)::text AS count FROM ${table}`);
    console.log(`${table}: ${count.rows[0].count}`);
  }

  printHeader("Result");
  if (issues === 0) {
    console.log("Schema looks complete for admin APIs.");
  } else {
    console.log(`${issues} issue(s) found. Run: npm run db:migrate-all`);
    process.exitCode = 1;
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("\nSchema check failed:", message);
  console.error("\nIf connection failed, verify DATABASE_URL (Neon direct URL, sslmode=require).");
  process.exitCode = 1;
} finally {
  await pool.end();
}
