import { query } from "@/lib/db";
import { loadTopQuoteGenerators } from "@/lib/quote-analytics";
import { OPEN_QUOTE_STATUS_SQL } from "@/lib/quote-validation";
import type {
  AdminDashboardData,
  AdminDashboardOverview,
  AdminDashboardRecentOrder,
  AdminDashboardRevenueDay,
  AdminDashboardTopProduct,
} from "@/types/admin-dashboard";
import type { OrderStatus } from "@/lib/order-status";
import { RECOGNIZED_ORDER_STATUS_SQL } from "@/lib/order-status";

type OverviewRow = {
  total_orders: string;
  pending_orders: string;
  confirmed_orders: string;
  completed_orders: string;
  orders_this_month: string;
  total_revenue: string;
  revenue_this_month: string;
  revenue_last_30_days: string;
  customer_count: string;
  pending_user_count: string;
  product_count: string;
  variant_count: string;
  active_finish_count: string;
  out_of_stock_count: string;
  potential_pipeline_revenue: string;
  open_quote_count: string;
};

type RecentOrderRow = {
  order_id: number;
  status: OrderStatus;
  total_price: string;
  created_at: string;
  company_name: string | null;
  email: string;
  item_count: string;
};

type TopProductRow = {
  product_name: string;
  product_sku: string;
  finish_name: string;
  units_sold: string;
  revenue: string;
};

type RevenueDayRow = {
  day: Date;
  order_count: string;
  revenue: string;
};

function toNumber(value: string | number) {
  return Number.parseFloat(String(value));
}

function mapOverview(row: OverviewRow): AdminDashboardOverview {
  return {
    totalOrders: Number.parseInt(row.total_orders, 10),
    pendingOrders: Number.parseInt(row.pending_orders, 10),
    confirmedOrders: Number.parseInt(row.confirmed_orders, 10),
    completedOrders: Number.parseInt(row.completed_orders, 10),
    ordersThisMonth: Number.parseInt(row.orders_this_month, 10),
    totalRevenue: toNumber(row.total_revenue),
    revenueThisMonth: toNumber(row.revenue_this_month),
    revenueLast30Days: toNumber(row.revenue_last_30_days),
    customerCount: Number.parseInt(row.customer_count, 10),
    pendingUserCount: Number.parseInt(row.pending_user_count, 10),
    productCount: Number.parseInt(row.product_count, 10),
    variantCount: Number.parseInt(row.variant_count, 10),
    activeFinishCount: Number.parseInt(row.active_finish_count, 10),
    outOfStockCount: Number.parseInt(row.out_of_stock_count, 10),
    potentialPipelineRevenue: toNumber(row.potential_pipeline_revenue),
    openQuoteCount: Number.parseInt(row.open_quote_count, 10),
  };
}

export async function loadAdminDashboardData(): Promise<AdminDashboardData> {
  const [overviewResult, recentOrdersResult, topProductsResult, revenueTrendResult, topQuoteGenerators] =
    await Promise.all([
      query<OverviewRow>(`
        SELECT
          (SELECT COUNT(*)::text FROM orders) AS total_orders,
          (SELECT COUNT(*)::text FROM orders WHERE status = 'pending') AS pending_orders,
          (SELECT COUNT(*)::text FROM orders WHERE status = 'confirmed') AS confirmed_orders,
          (SELECT COUNT(*)::text FROM orders WHERE status = 'completed') AS completed_orders,
          (
            SELECT COUNT(*)::text FROM orders
            WHERE created_at >= date_trunc('month', NOW())
          ) AS orders_this_month,
          (SELECT COALESCE(SUM(total_price), 0)::text FROM orders WHERE status IN ${RECOGNIZED_ORDER_STATUS_SQL}) AS total_revenue,
          (
            SELECT COALESCE(SUM(total_price), 0)::text FROM orders
            WHERE status IN ${RECOGNIZED_ORDER_STATUS_SQL}
              AND created_at >= date_trunc('month', NOW())
          ) AS revenue_this_month,
          (
            SELECT COALESCE(SUM(total_price), 0)::text FROM orders
            WHERE status IN ${RECOGNIZED_ORDER_STATUS_SQL}
              AND created_at >= NOW() - INTERVAL '30 days'
          ) AS revenue_last_30_days,
          (
            SELECT COUNT(*)::text FROM users
            WHERE role = 'customer' AND account_status = 'approved'
          ) AS customer_count,
          (
            SELECT COUNT(*)::text FROM users
            WHERE role = 'customer' AND account_status = 'pending'
          ) AS pending_user_count,
          (SELECT COUNT(*)::text FROM products) AS product_count,
          (SELECT COUNT(*)::text FROM product_variants) AS variant_count,
          (SELECT COUNT(*)::text FROM door_finishes WHERE is_active = true) AS active_finish_count,
          (
            SELECT COUNT(*)::text FROM product_variants
            WHERE stock_status = 'out_of_stock'
          ) AS out_of_stock_count,
          (
            SELECT COALESCE(SUM(total_amount * (1 - COALESCE(admin_discount_percent, 0) / 100.0)), 0)::text FROM quotes
            WHERE status IN ${OPEN_QUOTE_STATUS_SQL}
          ) AS potential_pipeline_revenue,
          (
            SELECT COUNT(*)::text FROM quotes
            WHERE status IN ${OPEN_QUOTE_STATUS_SQL}
          ) AS open_quote_count
      `),
      query<RecentOrderRow>(`
        SELECT
          o.id AS order_id,
          o.status,
          o.total_price,
          o.created_at,
          u.company_name,
          u.email,
          COALESCE(SUM(oi.quantity), 0)::text AS item_count
        FROM orders o
        JOIN users u ON u.id = o.user_id
        LEFT JOIN order_items oi ON oi.order_id = o.id
        GROUP BY o.id, u.company_name, u.email
        ORDER BY o.created_at DESC
        LIMIT 8
      `),
      query<TopProductRow>(`
        SELECT
          p.name AS product_name,
          p.sku AS product_sku,
          df.name AS finish_name,
          COALESCE(SUM(oi.quantity), 0)::text AS units_sold,
          COALESCE(SUM(oi.quantity * oi.price), 0)::text AS revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN product_variants pv ON pv.id = oi.variant_id
        JOIN products p ON p.id = pv.product_id
        JOIN door_finishes df ON df.id = pv.finish_id
        WHERE o.status IN ('confirmed', 'completed')
        GROUP BY p.id, p.name, p.sku, df.name
        ORDER BY SUM(oi.quantity) DESC, SUM(oi.quantity * oi.price) DESC
        LIMIT 6
      `),
      query<RevenueDayRow>(`
        SELECT
          date_trunc('day', created_at) AS day,
          COUNT(*)::text AS order_count,
          COALESCE(SUM(total_price), 0)::text AS revenue
        FROM orders
        WHERE status IN ('confirmed', 'completed')
          AND created_at >= NOW() - INTERVAL '14 days'
        GROUP BY 1
        ORDER BY 1 ASC
      `),
      loadTopQuoteGenerators(5),
    ]);

  const overview = mapOverview(overviewResult.rows[0]);

  const recentOrders: AdminDashboardRecentOrder[] = recentOrdersResult.rows.map((row) => ({
    id: row.order_id,
    status: row.status,
    totalPrice: toNumber(row.total_price),
    createdAt: row.created_at,
    customerCompany: row.company_name?.trim() || "—",
    customerEmail: row.email,
    itemCount: Number.parseInt(row.item_count, 10),
  }));

  const topProducts: AdminDashboardTopProduct[] = topProductsResult.rows.map((row) => ({
    productName: row.product_name,
    productSku: row.product_sku,
    finishName: row.finish_name,
    unitsSold: Number.parseInt(row.units_sold, 10),
    revenue: toNumber(row.revenue),
  }));

  const revenueTrend: AdminDashboardRevenueDay[] = revenueTrendResult.rows.map((row) => ({
    date: row.day.toISOString(),
    orderCount: Number.parseInt(row.order_count, 10),
    revenue: toNumber(row.revenue),
  }));

  return {
    overview,
    recentOrders,
    topProducts,
    revenueTrend,
    topQuoteGenerators,
  };
}
