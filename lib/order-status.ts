export const ORDER_STATUSES = [
  "pending",
  "processing",
  "confirmed",
  "shipped",
  "completed",
  "cancelled",
  "waiting_for_modification_payment",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_OPTIONS: Array<{ value: OrderStatus; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "confirmed", label: "Confirmed" },
  { value: "shipped", label: "Shipped" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  {
    value: "waiting_for_modification_payment",
    label: "Awaiting Payment",
  },
];

/** Statuses where admins may edit line items (Secure Order Modification Workflow). */
export const EDITABLE_ORDER_STATUSES = ["pending", "processing", "confirmed"] as const satisfies readonly OrderStatus[];

export const LOCKED_ORDER_STATUSES = [
  "shipped",
  "completed",
  "cancelled",
  "waiting_for_modification_payment",
] as const satisfies readonly OrderStatus[];

export function isOrderStatus(value: unknown): value is OrderStatus {
  return (
    typeof value === "string" &&
    ORDER_STATUSES.includes(value as OrderStatus)
  );
}

export function parseOrderStatusUpdate(body: unknown): OrderStatus | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const status = (body as Record<string, unknown>).status;

  return isOrderStatus(status) ? status : null;
}

export function isEditableOrderStatus(status: OrderStatus) {
  return (EDITABLE_ORDER_STATUSES as readonly string[]).includes(status);
}

export const RECOGNIZED_ORDER_STATUSES = [
  "confirmed",
  "processing",
  "completed",
] as const satisfies readonly OrderStatus[];

/** Active order statuses included in admin dashboard revenue and product analytics. */
export const DASHBOARD_ORDER_STATUSES = [
  "pending",
  "processing",
  "confirmed",
  "shipped",
  "completed",
] as const satisfies readonly OrderStatus[];

export function isRecognizedOrderStatus(status: OrderStatus) {
  return (
    status === "confirmed" ||
    status === "processing" ||
    status === "completed"
  );
}

export function isDashboardOrderStatus(status: OrderStatus) {
  return (DASHBOARD_ORDER_STATUSES as readonly string[]).includes(status);
}

export const RECOGNIZED_ORDER_STATUS_SQL = "('confirmed', 'processing', 'completed')";

export const DASHBOARD_ORDER_STATUS_SQL =
  "('pending', 'processing', 'confirmed', 'shipped', 'completed')";
