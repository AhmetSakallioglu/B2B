import { query } from "@/lib/db";
import type { AtRiskDealer, AtRiskDealerRiskReason, ChurnRadarResponse } from "@/types/churn-radar";

export const CHURN_LTV_THRESHOLD = 10_000;
export const CHURN_LOGIN_INACTIVE_DAYS = 30;
export const CHURN_ACTIVITY_INACTIVE_DAYS = 60;

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

function daysSince(iso: string | null) {
  if (!iso) {
    return null;
  }

  const diffMs = Date.now() - new Date(iso).getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export async function loadAtRiskDealers(): Promise<ChurnRadarResponse> {
  const result = await query<{
    user_id: number;
    email: string;
    company_name: string | null;
    contact_name: string | null;
    phone: string | null;
    last_login_at: Date | null;
    lifetime_value: string;
    completed_order_count: string;
    last_activity_at: Date | null;
    effective_last_login: Date | null;
  }>(
    `
      WITH vip_dealers AS (
        SELECT
          u.id,
          u.email,
          u.company_name,
          u.contact_name,
          u.phone,
          u.last_login_at,
          COALESCE(SUM(o.total_price) FILTER (WHERE o.status = 'completed'), 0)::numeric AS lifetime_value,
          COUNT(o.id) FILTER (WHERE o.status = 'completed')::int AS completed_order_count,
          MAX(o.created_at) AS last_order_at,
          (
            SELECT MAX(q.created_at)
            FROM quotes q
            WHERE q.user_id = u.id
          ) AS last_quote_at,
          (
            SELECT MAX(cq.created_at)
            FROM client_quotes cq
            WHERE cq.user_id = u.id
          ) AS last_client_quote_at
        FROM users u
        LEFT JOIN orders o ON o.user_id = u.id
        WHERE u.role = 'customer'
          AND u.account_status = 'approved'
        GROUP BY u.id
        HAVING COALESCE(SUM(o.total_price) FILTER (WHERE o.status = 'completed'), 0) > $1
      )
      SELECT
        vd.id AS user_id,
        vd.email,
        vd.company_name,
        vd.contact_name,
        vd.phone,
        vd.last_login_at,
        vd.lifetime_value::text,
        vd.completed_order_count::text,
        (
          SELECT MAX(activity_at)
          FROM unnest(ARRAY[vd.last_order_at, vd.last_quote_at, vd.last_client_quote_at]) AS activity_at
        ) AS last_activity_at,
        COALESCE(vd.last_login_at, vd.last_order_at) AS effective_last_login
      FROM vip_dealers vd
      WHERE
        COALESCE(vd.last_login_at, vd.last_order_at) < NOW() - ($2 || ' days')::interval
        OR COALESCE(
          (
            SELECT MAX(activity_at)
            FROM unnest(ARRAY[vd.last_order_at, vd.last_quote_at, vd.last_client_quote_at]) AS activity_at
          ),
          'epoch'::timestamptz
        ) < NOW() - ($3 || ' days')::interval
      ORDER BY vd.lifetime_value DESC, vd.email ASC
      LIMIT 25
    `,
    [CHURN_LTV_THRESHOLD, CHURN_LOGIN_INACTIVE_DAYS, CHURN_ACTIVITY_INACTIVE_DAYS]
  );

  const dealers: AtRiskDealer[] = result.rows.map((row) => {
    const lastLoginIso = row.effective_last_login?.toISOString() ?? null;
    const lastActivityIso = row.last_activity_at?.toISOString() ?? null;
    const daysSinceLogin = daysSince(lastLoginIso);
    const daysSinceActivity = daysSince(lastActivityIso);

    const riskReasons: AtRiskDealerRiskReason[] = [];

    if (daysSinceLogin === null || daysSinceLogin >= CHURN_LOGIN_INACTIVE_DAYS) {
      riskReasons.push("inactive_login");
    }

    if (daysSinceActivity === null || daysSinceActivity >= CHURN_ACTIVITY_INACTIVE_DAYS) {
      riskReasons.push("inactive_orders");
    }

    return {
      userId: row.user_id,
      companyName: displayCompanyName(row.company_name, row.contact_name, row.email),
      contactName: row.contact_name,
      email: row.email,
      phone: row.phone,
      lifetimeValue: toNumber(row.lifetime_value),
      completedOrderCount: Number.parseInt(row.completed_order_count, 10),
      lastLoginAt: row.last_login_at?.toISOString() ?? lastLoginIso,
      lastActivityAt: lastActivityIso,
      daysSinceLogin,
      daysSinceActivity,
      riskReasons,
    };
  });

  return {
    cachedAt: new Date().toISOString(),
    ltvThreshold: CHURN_LTV_THRESHOLD,
    dealers,
  };
}
