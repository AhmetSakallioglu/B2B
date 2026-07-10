import { query } from "@/lib/db";
import { RECOGNIZED_ORDER_STATUS_SQL } from "@/lib/order-status";
import { loadQuotePipelineSummary, loadTopQuoteGenerators } from "@/lib/quote-analytics";
import type { AdminDashboardStats } from "@/types/admin-dashboard";

export type DashboardDateRange = {
  startDate: string;
  endDate: string;
};

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function parseDashboardDateRange(
  searchParams: URLSearchParams,
  sanitized?: { startDate: string | null; endDate: string | null }
): DashboardDateRange {
  const endParam = sanitized?.endDate ?? searchParams.get("endDate");
  const startParam = sanitized?.startDate ?? searchParams.get("startDate");

  const endDate = endParam ? new Date(`${endParam}T23:59:59.999Z`) : new Date();
  const startDate = startParam
    ? new Date(`${startParam}T00:00:00.000Z`)
    : new Date(endDate.getTime() - 29 * 24 * 60 * 60 * 1000);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    const fallbackEnd = new Date();
    const fallbackStart = new Date(fallbackEnd.getTime() - 29 * 24 * 60 * 60 * 1000);
    return {
      startDate: toIsoDate(fallbackStart),
      endDate: toIsoDate(fallbackEnd),
    };
  }

  if (startDate > endDate) {
    return {
      startDate: toIsoDate(endDate),
      endDate: toIsoDate(startDate),
    };
  }

  return {
    startDate: toIsoDate(startDate),
    endDate: toIsoDate(endDate),
  };
}

function toNumber(value: string | number) {
  return Number.parseFloat(String(value));
}

export async function loadAdminDashboardStats(
  range: DashboardDateRange
): Promise<AdminDashboardStats> {
  const rangeStart = `${range.startDate}T00:00:00.000Z`;
  const rangeEnd = `${range.endDate}T23:59:59.999Z`;

  const [
    revenueResult,
    topProductsResult,
    topFinishesResult,
    topUsersResult,
    revenueTrendResult,
    quotePipeline,
    topQuoteGenerators,
  ] = await Promise.all([
    query<{ total_revenue: string; order_count: string }>(
      `
        SELECT
          COALESCE(SUM(total_price), 0)::text AS total_revenue,
          COUNT(*)::text AS order_count
        FROM orders
        WHERE status IN ${RECOGNIZED_ORDER_STATUS_SQL}
          AND created_at >= $1::timestamptz
          AND created_at <= $2::timestamptz
      `,
      [rangeStart, rangeEnd]
    ),
    query<{
      product_sku: string;
      product_name: string;
      units_sold: string;
    }>(
      `
        SELECT
          p.sku AS product_sku,
          p.name AS product_name,
          COALESCE(SUM(oi.quantity), 0)::text AS units_sold
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN product_variants pv ON pv.id = oi.variant_id
        JOIN products p ON p.id = pv.product_id
        WHERE o.status IN ${RECOGNIZED_ORDER_STATUS_SQL}
          AND o.created_at >= $1::timestamptz
          AND o.created_at <= $2::timestamptz
        GROUP BY p.id, p.sku, p.name
        ORDER BY SUM(oi.quantity) DESC, p.sku ASC
        LIMIT 5
      `,
      [rangeStart, rangeEnd]
    ),
    query<{
      finish_name: string;
      units_sold: string;
    }>(
      `
        SELECT
          df.name AS finish_name,
          COALESCE(SUM(oi.quantity), 0)::text AS units_sold
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN product_variants pv ON pv.id = oi.variant_id
        JOIN door_finishes df ON df.id = pv.finish_id
        WHERE o.status IN ${RECOGNIZED_ORDER_STATUS_SQL}
          AND o.created_at >= $1::timestamptz
          AND o.created_at <= $2::timestamptz
        GROUP BY df.id, df.name
        ORDER BY SUM(oi.quantity) DESC, df.name ASC
        LIMIT 3
      `,
      [rangeStart, rangeEnd]
    ),
    query<{
      user_id: number;
      company_name: string | null;
      email: string;
      total_spent: string;
      order_count: string;
    }>(
      `
        SELECT
          u.id AS user_id,
          u.company_name,
          u.email,
          COALESCE(SUM(o.total_price), 0)::text AS total_spent,
          COUNT(o.id)::text AS order_count
        FROM orders o
        JOIN users u ON u.id = o.user_id
        WHERE o.status IN ${RECOGNIZED_ORDER_STATUS_SQL}
          AND o.created_at >= $1::timestamptz
          AND o.created_at <= $2::timestamptz
        GROUP BY u.id, u.company_name, u.email
        ORDER BY SUM(o.total_price) DESC, COUNT(o.id) DESC
        LIMIT 3
      `,
      [rangeStart, rangeEnd]
    ),
    query<{
      day: Date;
      order_count: string;
      revenue: string;
    }>(
      `
        SELECT
          date_trunc('day', created_at) AS day,
          COUNT(*)::text AS order_count,
          COALESCE(SUM(total_price), 0)::text AS revenue
        FROM orders
        WHERE status IN ${RECOGNIZED_ORDER_STATUS_SQL}
          AND created_at >= $1::timestamptz
          AND created_at <= $2::timestamptz
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      [rangeStart, rangeEnd]
    ),
    loadQuotePipelineSummary(),
    loadTopQuoteGenerators(5),
  ]);

  const revenueRow = revenueResult.rows[0];

  return {
    startDate: range.startDate,
    endDate: range.endDate,
    revenue: {
      total: toNumber(revenueRow?.total_revenue ?? "0"),
      orderCount: Number.parseInt(revenueRow?.order_count ?? "0", 10),
    },
    topProducts: topProductsResult.rows.map((row) => ({
      productSku: row.product_sku,
      productName: row.product_name,
      unitsSold: Number.parseInt(row.units_sold, 10),
    })),
    topFinishes: topFinishesResult.rows.map((row) => ({
      finishName: row.finish_name,
      unitsSold: Number.parseInt(row.units_sold, 10),
    })),
    topUsers: topUsersResult.rows.map((row) => ({
      userId: row.user_id,
      companyName: row.company_name?.trim() || "—",
      email: row.email,
      totalSpent: toNumber(row.total_spent),
      orderCount: Number.parseInt(row.order_count, 10),
    })),
    revenueTrend: revenueTrendResult.rows.map((row) => ({
      date: row.day.toISOString(),
      orderCount: Number.parseInt(row.order_count, 10),
      revenue: toNumber(row.revenue),
    })),
    quotePipeline,
    topQuoteGenerators,
  };
}
