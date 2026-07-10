import { writeAuditLog } from "@/lib/audit-log";
import type { SecurityEventPayload } from "@/types/active-defense";
import type { SuspiciousAdminSearchAuditPayload } from "@/types/admin-search-sanitization";
import type { OrderCartSnapshotItem } from "@/types/order-modification";

export async function persistSecurityEvent(payload: SecurityEventPayload) {
  await writeAuditLog({
    userId: null,
    action: "UPDATE",
    tableName: "users",
    recordId: 0,
    newValues: {
      securityEvent: payload.event,
      ip: payload.ip,
      path: payload.path,
      category: payload.category ?? null,
      detail: payload.detail ?? null,
      userAgent: payload.userAgent ?? null,
      recordedAt: new Date().toISOString(),
    },
  });
}

export function getInternalSecurityKey() {
  return process.env.SECURITY_INTERNAL_KEY?.trim() ?? process.env.CRON_SECRET?.trim() ?? "";
}

export function isAuthorizedInternalSecurityRequest(request: Request) {
  const configuredKey = getInternalSecurityKey();

  if (!configuredKey) {
    return false;
  }

  const providedKey = request.headers.get("x-internal-security-key")?.trim();

  return Boolean(providedKey && providedKey === configuredKey);
}

export async function logSuspiciousAdminSearchAttempt(
  payload: Omit<SuspiciousAdminSearchAuditPayload, "event">
) {
  const auditPayload: SuspiciousAdminSearchAuditPayload = {
    event: "SUSPICIOUS_ADMIN_SEARCH_ATTEMPT",
    ...payload,
  };

  console.warn("[security:admin-search]", JSON.stringify(auditPayload));

  try {
    await writeAuditLog({
      userId: payload.adminUserId,
      action: "UPDATE",
      tableName: "users",
      recordId: payload.adminUserId,
      newValues: {
        securityEvent: auditPayload.event,
        route: auditPayload.route,
        param: auditPayload.param,
        searchTerm: auditPayload.searchTerm,
        reason: auditPayload.reason,
        ip: auditPayload.ip,
        userAgent: auditPayload.userAgent,
        recordedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to persist suspicious admin search audit log:", error);
  }
}

export async function logOrderModifiedByAdmin(params: {
  adminUserId: number;
  orderId: number;
  oldCart: OrderCartSnapshotItem[];
  newCart: OrderCartSnapshotItem[];
}) {
  const auditPayload = {
    event: "ORDER_MODIFIED_BY_ADMIN" as const,
    adminUserId: params.adminUserId,
    orderId: params.orderId,
    oldCart: params.oldCart,
    newCart: params.newCart,
    recordedAt: new Date().toISOString(),
  };

  console.info("[security:order-modified]", JSON.stringify(auditPayload));

  try {
    await writeAuditLog({
      userId: params.adminUserId,
      action: "UPDATE",
      tableName: "orders",
      recordId: params.orderId,
      oldValues: {
        securityEvent: auditPayload.event,
        cart: params.oldCart,
      },
      newValues: {
        securityEvent: auditPayload.event,
        cart: params.newCart,
        recordedAt: auditPayload.recordedAt,
      },
    });
  } catch (error) {
    console.error("Failed to persist order modification audit log:", error);
  }
}
