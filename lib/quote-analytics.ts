import { query } from "@/lib/db";
import { OPEN_QUOTE_STATUS_SQL } from "@/lib/quote-validation";
import {
  HOT_LEAD_MIN_QUOTES,
  type QuoteCustomerAnalytics,
  type QuoteCustomerAnalyticsRow,
  type QuotePipelineSummary,
  type TopQuoteGenerator,
} from "@/types/quote-analytics";

function toNumber(value: string | number) {
  return Number.parseFloat(String(value));
}

function mapCustomerAnalyticsRow(row: QuoteCustomerAnalyticsRow): QuoteCustomerAnalytics {
  const totalQuotes = Number.parseInt(row.total_quotes, 10);
  const orderCount = Number.parseInt(row.order_count, 10);

  return {
    userId: row.user_id,
    contactName: row.contact_name?.trim() || "—",
    companyName: row.company_name?.trim() || "—",
    email: row.email,
    phone: row.phone?.trim() || "—",
    totalQuotes,
    totalPotentialRevenue: toNumber(row.total_potential_revenue),
    lastActivityAt: row.last_activity_at,
    orderCount,
    isHotLead: totalQuotes > HOT_LEAD_MIN_QUOTES && orderCount === 0,
  };
}

export async function listQuoteCustomerAnalytics(): Promise<QuoteCustomerAnalytics[]> {
  const result = await query<QuoteCustomerAnalyticsRow>(
    `
      SELECT
        u.id AS user_id,
        u.contact_name,
        u.company_name,
        u.email,
        u.phone,
        COUNT(q.id)::text AS total_quotes,
        COALESCE(SUM(q.total_amount * (1 - COALESCE(q.admin_discount_percent, 0) / 100.0)), 0)::text AS total_potential_revenue,
        MAX(GREATEST(q.updated_at, q.created_at))::text AS last_activity_at,
        (
          SELECT COUNT(*)::text
          FROM orders o
          WHERE o.user_id = u.id
        ) AS order_count
      FROM users u
      INNER JOIN quotes q ON q.user_id = u.id AND q.status <> 'archived'
      WHERE u.role = 'customer'
      GROUP BY u.id, u.contact_name, u.company_name, u.email, u.phone
      ORDER BY SUM(q.total_amount * (1 - COALESCE(q.admin_discount_percent, 0) / 100.0)) DESC, COUNT(q.id) DESC, u.company_name ASC NULLS LAST
    `
  );

  return result.rows.map(mapCustomerAnalyticsRow);
}

export async function loadQuotePipelineSummary(): Promise<QuotePipelineSummary> {
  const result = await query<{
    potential_pipeline_revenue: string;
    open_quote_count: string;
  }>(
    `
      SELECT
        COALESCE(SUM(total_amount * (1 - COALESCE(admin_discount_percent, 0) / 100.0)), 0)::text AS potential_pipeline_revenue,
        COUNT(*)::text AS open_quote_count
      FROM quotes
      WHERE status IN ${OPEN_QUOTE_STATUS_SQL}
    `
  );

  const row = result.rows[0];

  return {
    potentialPipelineRevenue: toNumber(row?.potential_pipeline_revenue ?? "0"),
    openQuoteCount: Number.parseInt(row?.open_quote_count ?? "0", 10),
  };
}

export async function loadTopQuoteGenerators(limit = 5): Promise<TopQuoteGenerator[]> {
  const result = await query<{
    user_id: number;
    contact_name: string | null;
    company_name: string | null;
    email: string;
    total_quotes: string;
    total_potential_revenue: string;
  }>(
    `
      SELECT
        u.id AS user_id,
        u.contact_name,
        u.company_name,
        u.email,
        COUNT(q.id)::text AS total_quotes,
        COALESCE(SUM(q.total_amount * (1 - COALESCE(q.admin_discount_percent, 0) / 100.0)), 0)::text AS total_potential_revenue
      FROM users u
      INNER JOIN quotes q ON q.user_id = u.id AND q.status <> 'archived'
      WHERE u.role = 'customer'
      GROUP BY u.id, u.contact_name, u.company_name, u.email
      ORDER BY COUNT(q.id) DESC, SUM(q.total_amount * (1 - COALESCE(q.admin_discount_percent, 0) / 100.0)) DESC
      LIMIT $1
    `,
    [limit]
  );

  return result.rows.map((row) => ({
    userId: row.user_id,
    contactName: row.contact_name?.trim() || "—",
    companyName: row.company_name?.trim() || "—",
    email: row.email,
    totalQuotes: Number.parseInt(row.total_quotes, 10),
    totalPotentialRevenue: toNumber(row.total_potential_revenue),
  }));
}
