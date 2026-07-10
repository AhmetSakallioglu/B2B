import { query } from "@/lib/db";
import { toDashboardTimestamps } from "@/lib/admin-date-range";
import type { DashboardDateRange } from "@/lib/admin-dashboard-stats";
import { DASHBOARD_ORDER_STATUS_SQL } from "@/lib/order-status";
import type { AdminDashboardExtendedData } from "@/types/admin-dashboard-extended";

function toNumber(value: string | number) {
  return Number.parseFloat(String(value));
}

function displayCompanyName(
  companyName: string | null,
  contactName: string | null,
  email: string
) {
  return companyName?.trim() || contactName?.trim() || email;
}

async function loadSystemAlerts() {
  const result = await query<{
    pending_dealers: string;
    pending_fulfillment: string;
  }>(`
    SELECT
      (
        SELECT COUNT(*)::text FROM users
        WHERE role = 'customer' AND account_status = 'pending'
      ) AS pending_dealers,
      (
        SELECT COUNT(*)::text FROM orders
        WHERE status IN ('pending', 'confirmed', 'processing')
      ) AS pending_fulfillment
  `);

  const row = result.rows[0];

  return {
    pendingDealerApplications: Number.parseInt(row?.pending_dealers ?? "0", 10),
    pendingFulfillmentOrders: Number.parseInt(row?.pending_fulfillment ?? "0", 10),
  };
}

async function loadTopFinishes(range: DashboardDateRange) {
  const { rangeStart, rangeEnd } = toDashboardTimestamps(range);

  const result = await query<{
    finish_id: number;
    finish_name: string;
    sample_image_url: string | null;
    units_sold: string;
    revenue: string;
  }>(
    `
    SELECT
      df.id AS finish_id,
      df.name AS finish_name,
      df.sample_image_url,
      COALESCE(SUM(oi.quantity), 0)::text AS units_sold,
      COALESCE(SUM(oi.quantity * oi.price), 0)::text AS revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN product_variants pv ON pv.id = oi.variant_id
    JOIN door_finishes df ON df.id = pv.finish_id
    WHERE o.status IN ${DASHBOARD_ORDER_STATUS_SQL}
      AND o.created_at >= $1::timestamptz
      AND o.created_at <= $2::timestamptz
    GROUP BY df.id, df.name, df.sample_image_url
    ORDER BY SUM(oi.quantity * oi.price) DESC, SUM(oi.quantity) DESC
    LIMIT 3
  `,
    [rangeStart, rangeEnd]
  );

  return result.rows.map((row) => ({
    finishId: row.finish_id,
    finishName: row.finish_name,
    sampleImageUrl: row.sample_image_url,
    unitsSold: Number.parseInt(row.units_sold, 10),
    revenue: toNumber(row.revenue),
  }));
}

async function loadTopCabinets(range: DashboardDateRange) {
  const { rangeStart, rangeEnd } = toDashboardTimestamps(range);

  const result = await query<{
    cabinet_code: string;
    product_name: string;
    units_sold: string;
  }>(
    `
    SELECT
      p.sku AS cabinet_code,
      p.name AS product_name,
      COALESCE(SUM(oi.quantity), 0)::text AS units_sold
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN product_variants pv ON pv.id = oi.variant_id
    JOIN products p ON p.id = pv.product_id
    WHERE o.status IN ${DASHBOARD_ORDER_STATUS_SQL}
      AND o.created_at >= $1::timestamptz
      AND o.created_at <= $2::timestamptz
    GROUP BY p.id, p.sku, p.name
    ORDER BY SUM(oi.quantity) DESC, p.sku ASC
    LIMIT 5
  `,
    [rangeStart, rangeEnd]
  );

  return result.rows.map((row) => ({
    cabinetCode: row.cabinet_code,
    productName: row.product_name,
    unitsSold: Number.parseInt(row.units_sold, 10),
  }));
}

async function loadTopDealers(range: DashboardDateRange) {
  const { rangeStart, rangeEnd } = toDashboardTimestamps(range);

  const result = await query<{
    user_id: number;
    company_name: string | null;
    contact_name: string | null;
    email: string;
    order_count: string;
    lifetime_value: string;
  }>(
    `
    SELECT
      u.id AS user_id,
      u.company_name,
      u.contact_name,
      u.email,
      COUNT(o.id)::text AS order_count,
      COALESCE(SUM(o.total_price), 0)::text AS lifetime_value
    FROM orders o
    JOIN users u ON u.id = o.user_id
    WHERE o.status IN ${DASHBOARD_ORDER_STATUS_SQL}
      AND o.created_at >= $1::timestamptz
      AND o.created_at <= $2::timestamptz
    GROUP BY u.id, u.company_name, u.contact_name, u.email
    ORDER BY SUM(o.total_price) DESC, COUNT(o.id) DESC
    LIMIT 3
  `,
    [rangeStart, rangeEnd]
  );

  return result.rows.map((row) => ({
    userId: row.user_id,
    companyName: displayCompanyName(row.company_name, row.contact_name, row.email),
    email: row.email,
    orderCount: Number.parseInt(row.order_count, 10),
    lifetimeValue: toNumber(row.lifetime_value),
  }));
}

export async function loadAdminDashboardExtendedData(
  range: DashboardDateRange
): Promise<AdminDashboardExtendedData> {
  const [alerts, topFinishes, topCabinets, topDealers] = await Promise.all([
    loadSystemAlerts(),
    loadTopFinishes(range),
    loadTopCabinets(range),
    loadTopDealers(range),
  ]);

  return {
    alerts,
    topFinishes,
    topCabinets,
    topDealers,
    dateRange: range,
  };
}
