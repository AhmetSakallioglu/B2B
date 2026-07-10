import { query } from "@/lib/db";
import { toDashboardTimestamps } from "@/lib/admin-date-range";
import type { DashboardDateRange } from "@/lib/admin-dashboard-stats";
import {
  getAbandonedCartAnalytics,
} from "@/lib/abandoned-cart-analytics";
import { listPendingTaxExemptionReviews } from "@/lib/tax-exemption";
import { DASHBOARD_ORDER_STATUS_SQL } from "@/lib/order-status";
import type {
  AdminCommandCenterData,
  CommandCenterActivity,
  CommandCenterActivityTone,
  CommandCenterTrendMonth,
} from "@/types/admin-command-center";

function toNumber(value: string | number) {
  return Number.parseFloat(String(value));
}

type TrendGranularity = "day" | "week" | "month";

function getTrendGranularity(range: DashboardDateRange): TrendGranularity {
  const { rangeStart, rangeEnd } = toDashboardTimestamps(range);
  const dayMs = 24 * 60 * 60 * 1000;
  const days =
    Math.floor(
      (new Date(rangeEnd).getTime() - new Date(rangeStart).getTime()) / dayMs
    ) + 1;

  if (days <= 31) {
    return "day";
  }

  if (days <= 120) {
    return "week";
  }

  return "month";
}

function formatTrendLabel(date: Date, granularity: TrendGranularity) {
  if (granularity === "day") {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
  }

  if (granularity === "week") {
    return `Wk of ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date)}`;
  }

  return new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit" }).format(date);
}

function displayName(companyName: string | null, contactName: string | null, email: string) {
  return companyName?.trim() || contactName?.trim() || email;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

async function loadKpis(range: DashboardDateRange) {
  const { rangeStart, rangeEnd } = toDashboardTimestamps(range);
  const rangeStartMs = new Date(rangeStart).getTime();
  const rangeEndMs = new Date(rangeEnd).getTime();
  const durationMs = Math.max(rangeEndMs - rangeStartMs + 1, 24 * 60 * 60 * 1000);
  const previousStart = new Date(rangeStartMs - durationMs).toISOString();
  const previousEnd = new Date(rangeStartMs - 1).toISOString();

  const [revenueResult, pendingResult, activeDealersResult] = await Promise.all([
    query<{
      revenue_current: string;
      revenue_previous: string;
    }>(
      `
      SELECT
        COALESCE(SUM(total_price) FILTER (
          WHERE created_at >= $1::timestamptz AND created_at <= $2::timestamptz
        ), 0)::text AS revenue_current,
        COALESCE(SUM(total_price) FILTER (
          WHERE created_at >= $3::timestamptz AND created_at <= $4::timestamptz
        ), 0)::text AS revenue_previous
      FROM orders
      WHERE status IN ${DASHBOARD_ORDER_STATUS_SQL}
    `,
      [rangeStart, rangeEnd, previousStart, previousEnd]
    ),
    query<{
      pending_dealers: string;
      pending_tax: string;
    }>(`
      SELECT
        (
          SELECT COUNT(*)::text FROM users
          WHERE role = 'customer' AND account_status = 'pending'
        ) AS pending_dealers,
        (
          SELECT COUNT(*)::text FROM users
          WHERE role = 'customer'
            AND tax_exemption_status = 'PENDING'
            AND COALESCE(resale_certificate_url, tax_document_url) IS NOT NULL
        ) AS pending_tax
    `),
    query<{ active_dealers: string }>(
      `
      SELECT COUNT(*)::text AS active_dealers
      FROM (
        SELECT user_id FROM orders
        WHERE created_at >= $1::timestamptz AND created_at <= $2::timestamptz
        UNION
        SELECT user_id FROM client_quotes
        WHERE created_at >= $1::timestamptz AND created_at <= $2::timestamptz
        UNION
        SELECT user_id FROM quotes
        WHERE created_at >= $1::timestamptz AND created_at <= $2::timestamptz
      ) active_users
    `,
      [rangeStart, rangeEnd]
    ),
  ]);

  const revenueRow = revenueResult.rows[0];
  const pendingRow = pendingResult.rows[0];
  const revenueCurrent = toNumber(revenueRow?.revenue_current ?? "0");
  const revenuePrevious = toNumber(revenueRow?.revenue_previous ?? "0");

  let monthlyRevenueChangePercent: number | null = null;

  if (revenuePrevious > 0) {
    monthlyRevenueChangePercent = Math.round(
      ((revenueCurrent - revenuePrevious) / revenuePrevious) * 100
    );
  } else if (revenueCurrent > 0) {
    monthlyRevenueChangePercent = 100;
  }

  const pendingDealerApplications = Number.parseInt(pendingRow?.pending_dealers ?? "0", 10);
  const pendingTaxExemptions = Number.parseInt(pendingRow?.pending_tax ?? "0", 10);

  const abandonedAnalytics = await getAbandonedCartAnalytics();
  const hotCarts = abandonedAnalytics.carts.filter((cart) => cart.temperature === "HOT");
  const recoverableHotCartRevenue = hotCarts.reduce((sum, cart) => sum + cart.cartTotal, 0);

  return {
    monthlyRevenue: revenueCurrent,
    monthlyRevenueChangePercent,
    pendingApprovals: pendingDealerApplications + pendingTaxExemptions,
    pendingDealerApplications,
    pendingTaxExemptions,
    recoverableHotCartRevenue,
    hotCartCount: hotCarts.length,
    activeDealersThisMonth: Number.parseInt(
      activeDealersResult.rows[0]?.active_dealers ?? "0",
      10
    ),
  };
}

async function loadSalesTrend(range: DashboardDateRange): Promise<CommandCenterTrendMonth[]> {
  const { rangeStart, rangeEnd } = toDashboardTimestamps(range);
  const granularity = getTrendGranularity(range);
  const truncUnit = granularity === "day" ? "day" : granularity === "week" ? "week" : "month";
  const interval =
    granularity === "day" ? "1 day" : granularity === "week" ? "1 week" : "1 month";

  const result = await query<{
    period_start: Date;
    order_revenue: string;
    order_count: string;
    client_quote_revenue: string;
    client_quote_count: string;
  }>(
    `
    WITH bounds AS (
      SELECT
        date_trunc('${truncUnit}', $1::timestamptz) AS range_start_period,
        date_trunc('${truncUnit}', $2::timestamptz) AS range_end_period
    ),
    periods AS (
      SELECT generate_series(
        (SELECT range_start_period FROM bounds),
        (SELECT range_end_period FROM bounds),
        INTERVAL '${interval}'
      ) AS period_start
    )
    SELECT
      p.period_start,
      COALESCE(SUM(o.total_price) FILTER (
        WHERE o.status IN ${DASHBOARD_ORDER_STATUS_SQL}
      ), 0)::text AS order_revenue,
      COUNT(o.id) FILTER (
        WHERE o.status IN ${DASHBOARD_ORDER_STATUS_SQL}
      )::text AS order_count,
      (
        SELECT COALESCE(SUM(cq.total_amount), 0)::text
        FROM client_quotes cq
        WHERE date_trunc('${truncUnit}', cq.created_at) = p.period_start
          AND cq.created_at >= $1::timestamptz
          AND cq.created_at <= $2::timestamptz
      ) AS client_quote_revenue,
      (
        SELECT COUNT(*)::text
        FROM client_quotes cq
        WHERE date_trunc('${truncUnit}', cq.created_at) = p.period_start
          AND cq.created_at >= $1::timestamptz
          AND cq.created_at <= $2::timestamptz
      ) AS client_quote_count
    FROM periods p
    LEFT JOIN orders o
      ON date_trunc('${truncUnit}', o.created_at) = p.period_start
      AND o.created_at >= $1::timestamptz
      AND o.created_at <= $2::timestamptz
    GROUP BY p.period_start
    ORDER BY p.period_start ASC
  `,
    [rangeStart, rangeEnd]
  );

  return result.rows.map((row) => ({
    monthKey: row.period_start.toISOString(),
    monthLabel: formatTrendLabel(row.period_start, granularity),
    completedOrderRevenue: toNumber(row.order_revenue),
    completedOrderCount: Number.parseInt(row.order_count, 10),
    clientQuoteRevenue: toNumber(row.client_quote_revenue),
    clientQuoteCount: Number.parseInt(row.client_quote_count, 10),
  }));
}

async function loadRecentActivity(): Promise<CommandCenterActivity[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [ordersResult, quotesResult, taxResult, registrationsResult] = await Promise.all([
    query<{
      id: number;
      total_price: string;
      status: string;
      created_at: Date;
      company_name: string | null;
      contact_name: string | null;
      email: string;
    }>(`
      SELECT
        o.id,
        o.total_price,
        o.status,
        o.created_at,
        u.company_name,
        u.contact_name,
        u.email
      FROM orders o
      JOIN users u ON u.id = o.user_id
      WHERE o.created_at >= $1
      ORDER BY o.created_at DESC
      LIMIT 8
    `, [since]),
    query<{
      id: number;
      total_amount: string;
      client_name: string;
      created_at: Date;
      company_name: string | null;
      contact_name: string | null;
      email: string;
    }>(`
      SELECT
        cq.id,
        cq.total_amount,
        cq.client_name,
        cq.created_at,
        u.company_name,
        u.contact_name,
        u.email
      FROM client_quotes cq
      JOIN users u ON u.id = cq.user_id
      WHERE cq.created_at >= $1
      ORDER BY cq.created_at DESC
      LIMIT 8
    `, [since]),
    query<{
      id: number;
      company_name: string | null;
      contact_name: string | null;
      email: string;
      updated_at: Date;
    }>(`
      SELECT id, company_name, contact_name, email, updated_at
      FROM users
      WHERE role = 'customer'
        AND tax_exemption_status = 'PENDING'
        AND COALESCE(resale_certificate_url, tax_document_url) IS NOT NULL
        AND updated_at >= $1
      ORDER BY updated_at DESC
      LIMIT 6
    `, [since]),
    query<{
      id: number;
      company_name: string | null;
      contact_name: string | null;
      email: string;
      created_at: Date;
    }>(`
      SELECT id, company_name, contact_name, email, created_at
      FROM users
      WHERE role = 'customer'
        AND account_status = 'pending'
        AND created_at >= $1
      ORDER BY created_at DESC
      LIMIT 6
    `, [since]),
  ]);

  const activities: CommandCenterActivity[] = [];

  for (const order of ordersResult.rows) {
    const dealer = displayName(order.company_name, order.contact_name, order.email);
    const tone: CommandCenterActivityTone =
      order.status === "completed" ? "emerald" : order.status === "pending" ? "amber" : "brand";

    activities.push({
      id: `order-${order.id}-${order.created_at.toISOString()}`,
      message:
        order.status === "completed"
          ? `Order #${order.id} completed for ${dealer} (${formatCurrency(toNumber(order.total_price))})`
          : `Order #${order.id} placed by ${dealer} (${formatCurrency(toNumber(order.total_price))})`,
      timestamp: order.created_at.toISOString(),
      tone,
    });
  }

  for (const quote of quotesResult.rows) {
    const dealer = displayName(quote.company_name, quote.contact_name, quote.email);

    activities.push({
      id: `client-quote-${quote.id}-${quote.created_at.toISOString()}`,
      message: `${dealer} created a client quote for ${quote.client_name} (${formatCurrency(toNumber(quote.total_amount))})`,
      timestamp: quote.created_at.toISOString(),
      tone: "brand",
    });
  }

  for (const tax of taxResult.rows) {
    const dealer = displayName(tax.company_name, tax.contact_name, tax.email);

    activities.push({
      id: `tax-${tax.id}-${tax.updated_at.toISOString()}`,
      message: `${dealer} uploaded a resale certificate for tax review`,
      timestamp: tax.updated_at.toISOString(),
      tone: "rose",
    });
  }

  for (const registration of registrationsResult.rows) {
    const dealer = displayName(
      registration.company_name,
      registration.contact_name,
      registration.email
    );

    activities.push({
      id: `registration-${registration.id}-${registration.created_at.toISOString()}`,
      message: `New dealer application from ${dealer}`,
      timestamp: registration.created_at.toISOString(),
      tone: "amber",
    });
  }

  return activities
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
    .slice(0, 12);
}

async function loadTopAbandonedCarts() {
  const analytics = await getAbandonedCartAnalytics();

  return analytics.carts
    .sort((left, right) => right.cartTotal - left.cartTotal)
    .slice(0, 5)
    .map((cart) => ({
      userId: cart.userId,
      companyName: cart.companyName?.trim() || cart.contactName?.trim() || cart.email,
      contactName: cart.contactName,
      phone: cart.phone,
      email: cart.email,
      cartTotal: cart.cartTotal,
      itemCount: cart.itemCount,
      lastActiveAt: cart.lastActiveAt,
      temperature: cart.temperature,
    }));
}

async function loadPendingTaxExemptions() {
  const reviews = await listPendingTaxExemptionReviews();

  return reviews.slice(0, 5).map((review) => ({
    userId: review.userId,
    companyName: review.companyName,
    contactName: review.contactName,
    email: review.email,
    submittedAt: review.submittedAt ?? new Date().toISOString(),
    certificateUrl: review.resaleCertificateUrl,
  }));
}

export async function loadAdminCommandCenterData(
  range: DashboardDateRange
): Promise<AdminCommandCenterData> {
  const [kpis, salesTrend, recentActivity, topAbandonedCarts, pendingTaxExemptions] =
    await Promise.all([
      loadKpis(range),
      loadSalesTrend(range),
      loadRecentActivity(),
      loadTopAbandonedCarts(),
      loadPendingTaxExemptions(),
    ]);

  return {
    kpis,
    salesTrend,
    recentActivity,
    topAbandonedCarts,
    pendingTaxExemptions,
    dateRange: range,
  };
}
