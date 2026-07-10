import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit-log";
import { getClientIp } from "@/lib/request-security";

export const PRIVILEGE_CONTROLLED_FIELDS = [
  "role",
  "account_status",
  "accountStatus",
  "is_super_admin",
  "isSuperAdmin",
  "is_tax_exempt",
  "isTaxExempt",
  "tax_exemption_status",
  "taxExemptionStatus",
  "session_version",
  "sessionVersion",
  "permissions",
  "is_admin",
  "isAdmin",
  "user_id",
  "userId",
  "dealer_tier_id",
  "dealerTierId",
  "discount_percent",
  "discountPercent",
] as const;

export type PrivilegeControlledField = (typeof PRIVILEGE_CONTROLLED_FIELDS)[number];

const PRIVILEGE_FIELD_SET = new Set<string>(PRIVILEGE_CONTROLLED_FIELDS);

export type PrivilegeEscalationContext = {
  route: string;
  source?: "registration" | "profile" | "api";
};

export function findPrivilegeEscalationFields(
  value: unknown,
  prefix = "",
  found: string[] = []
): string[] {
  if (!value || typeof value !== "object") {
    return found;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      findPrivilegeEscalationFields(entry, `${prefix}[${index}]`, found);
    });

    return found;
  }

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (PRIVILEGE_FIELD_SET.has(key)) {
      found.push(path);
    }

    if (nested && typeof nested === "object") {
      findPrivilegeEscalationFields(nested, path, found);
    }
  }

  return found;
}

export async function logPrivilegeEscalationAttempt(
  request: Request,
  fields: string[],
  context: PrivilegeEscalationContext
) {
  const payload = {
    event: "PRIVILEGE_ESCALATION_BLOCKED",
    route: context.route,
    source: context.source ?? "api",
    fields,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
  };

  console.warn("[security:privilege-escalation]", JSON.stringify(payload));

  try {
    await writeAuditLog({
      userId: null,
      action: "UPDATE",
      tableName: "users",
      recordId: 0,
      newValues: payload,
    });
  } catch (error) {
    console.error("Failed to persist privilege escalation audit log:", error);
  }
}

export async function rejectPrivilegeEscalationAttempt(
  request: Request,
  body: unknown,
  context: PrivilegeEscalationContext
): Promise<NextResponse | null> {
  const fields = findPrivilegeEscalationFields(body);

  if (fields.length === 0) {
    return null;
  }

  await logPrivilegeEscalationAttempt(request, fields, context);

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
