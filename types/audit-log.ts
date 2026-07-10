export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "SOFT_DELETE"
  | "RESTORE"
  | "USER_TAX_EXEMPTION_APPROVED"
  | "USER_TAX_EXEMPTION_REJECTED";

export type AuditableTable =
  | "products"
  | "product_variants"
  | "door_finishes"
  | "users"
  | "customer_tiers"
  | "quotes"
  | "announcement_popups"
  | "orders"
  | "email_templates"
  | "dealer_groups"
  | "admin_permissions"
  | "shipping_zones"
  | "categories"
  | "sub_categories";

export const RESTORABLE_TABLES = new Set<AuditableTable>([
  "products",
  "product_variants",
  "door_finishes",
]);

export type AuditLogRow = {
  id: number;
  user_id: number | null;
  user_email: string | null;
  action: AuditAction;
  table_name: AuditableTable;
  record_id: number;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  created_at: string;
  restored_at: string | null;
  restored_by: number | null;
};

export type AuditLogEntry = {
  id: number;
  userId: number | null;
  userEmail: string | null;
  action: AuditAction;
  tableName: AuditableTable;
  recordId: number;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  createdAt: string;
  restoredAt: string | null;
  restoredBy: number | null;
  canRestore: boolean;
  summary: string;
};
