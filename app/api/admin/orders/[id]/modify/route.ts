import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/api-auth";
import { getClientIpFromRequest } from "@/lib/client-ip";
import {
  detectSuspiciousAdminSearchInput,
  invalidAdminSearchResponse,
} from "@/lib/admin-search-sanitization";
import { applySecureOrderModification } from "@/lib/order-modification";
import {
  modificationValidationResponse,
  parseOrderModificationPayload,
} from "@/lib/order-modification-input";
import { logSuspiciousAdminSearchAttempt } from "@/lib/security-audit";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function resolveAppOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configured) {
    return configured.replace(/\/$/, "");
  }

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") ?? "http";

  if (host) {
    return `${protocol}://${host}`;
  }

  return "http://localhost:3000";
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("can_edit_orders", request);

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const orderId = Number.parseInt(id, 10);

  if (Number.isNaN(orderId)) {
    return NextResponse.json({ error: "Invalid order id" }, { status: 400 });
  }

  const rawBody = await request.json();

  for (const entry of Array.isArray((rawBody as { items?: unknown }).items)
    ? ((rawBody as { items: Array<Record<string, unknown>> }).items ?? [])
    : []) {
    if (typeof entry?.variantSku === "string") {
      const detection = detectSuspiciousAdminSearchInput("variantSku", entry.variantSku);

      if (detection) {
        await logSuspiciousAdminSearchAttempt({
          adminUserId: auth.user!.id,
          route: `/api/admin/orders/${orderId}/modify`,
          param: detection.param,
          searchTerm: detection.rawValue,
          reason: detection.reason,
          ip: getClientIpFromRequest(request),
          userAgent: request.headers.get("user-agent"),
        });

        return invalidAdminSearchResponse();
      }
    }
  }

  const modifications = parseOrderModificationPayload(rawBody);

  if (!modifications) {
    return modificationValidationResponse();
  }

  try {
    const result = await applySecureOrderModification({
      orderId,
      adminUserId: auth.user!.id,
      modifications,
      appOrigin: resolveAppOrigin(request),
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.result);
  } catch (error) {
    console.error("POST /api/admin/orders/[id]/modify failed:", error);
    return NextResponse.json({ error: "Failed to modify order" }, { status: 500 });
  }
}
