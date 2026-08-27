export type SuspiciousAdminSearchDetection = {
  param: string;
  rawValue: string;
  reason: string;
};

export type SuspiciousAdminSearchAuditPayload = {
  event: "SUSPICIOUS_ADMIN_SEARCH_ATTEMPT";
  adminUserId: number;
  route: string;
  param: string;
  searchTerm: string;
  reason: string;
  ip: string;
  userAgent: string | null;
};

export const ADMIN_SEARCH_PARAM_LIMITS = {
  query: 200,
  category: 80,
  stock: 40,
  finish: 80,
  status: 32,
  scope: 32,
  date: 32,
  userId: 16,
  variantSku: 64,
  quantity: 8,
  campaignTitle: 120,
  campaignBody: 2000,
  campaignActionUrl: 500,
  campaignName: 120,
} as const;

export const ANNOUNCEMENT_FREQUENCY_VALUES = ["ONCE", "EVERY_SESSION", "MAX_LIMIT"] as const;

export const ADMIN_USER_STATUS_VALUES = ["all", "pending", "approved", "rejected", "deleted"] as const;

export const ADMIN_PRODUCT_STOCK_VALUES = ["all", "in_stock", "out_of_stock"] as const;

export const ADMIN_PRODUCT_SCOPE_VALUES = ["group"] as const;

export const ADMIN_ORDER_STATUS_VALUES = [
  "all",
  "pending",
  "processing",
  "confirmed",
  "shipped",
  "completed",
  "cancelled",
  "waiting_for_modification_payment",
] as const;

/** Orders list UI/API filter dropdown allowlist (all order statuses). */
export const ADMIN_ORDER_LIST_FILTER_VALUES = ADMIN_ORDER_STATUS_VALUES;

export const ADMIN_DATE_PARAM_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type AdminUserStatusFilter = (typeof ADMIN_USER_STATUS_VALUES)[number];
export type AdminProductStockFilter = (typeof ADMIN_PRODUCT_STOCK_VALUES)[number];
export type AdminOrderStatusFilter = (typeof ADMIN_ORDER_STATUS_VALUES)[number];
export type AdminOrderListFilter = AdminOrderStatusFilter;

export type AdminSearchGuardResult<T> =
  | { ok: true; value: T }
  | { ok: false; response: Response };
