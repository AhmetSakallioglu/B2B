import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getClientIpFromRequest } from "@/lib/client-ip";
import {
  AUTH_BACKOFF_SCOPES,
  checkExponentialBackoff,
  recordExponentialBackoffFailure,
} from "@/lib/exponential-backoff-limit";
import { describeHoneypotHit, isHoneypotPath } from "@/lib/honeypot-defense";
import { banIpPermanent, banIpTemporary } from "@/lib/ip-ban-store";
import { resolveEdgeIpSecurityState } from "@/lib/edge-security-batch";
import {
  createIntrusionBlockedResponse,
  createIpBannedResponse,
  scanRequestForIntrusion,
} from "@/lib/intrusion-prevention";
import { getInternalSecurityKey } from "@/lib/security-audit";
import type { SecurityEventPayload } from "@/types/active-defense";
import type { AuthBackoffScope } from "@/lib/exponential-backoff-limit";

function scheduleSecurityEventReport(request: NextRequest, payload: SecurityEventPayload) {
  const internalKey = getInternalSecurityKey();

  if (!internalKey) {
    console.warn("[security]", JSON.stringify(payload));
    return;
  }

  const reportUrl = new URL("/api/internal/security-event", request.url);

  void fetch(reportUrl.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-security-key": internalKey,
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  }).catch((error) => {
    console.warn("Failed to report security event.", error);
  });
}

export async function enforceActiveDefense(request: NextRequest): Promise<Response | null> {
  const clientIp = getClientIpFromRequest(request);
  const { pathname } = request.nextUrl;

  const ipSecurity = await resolveEdgeIpSecurityState(clientIp);

  if (ipSecurity.banned || ipSecurity.authLockedOut) {
    return createIpBannedResponse();
  }

  if (isHoneypotPath(pathname)) {
    await banIpPermanent(clientIp, describeHoneypotHit({ ip: clientIp, path: pathname, userAgent: request.headers.get("user-agent") }));

    scheduleSecurityEventReport(request, {
      event: "CRITICAL_HACKING_ATTEMPT",
      ip: clientIp,
      path: pathname,
      category: "honeypot",
      detail: describeHoneypotHit({
        ip: clientIp,
        path: pathname,
        userAgent: request.headers.get("user-agent"),
      }),
      userAgent: request.headers.get("user-agent"),
    });

    return createIpBannedResponse();
  }

  const intrusion = scanRequestForIntrusion(request);

  if (intrusion.blocked) {
    await banIpTemporary(clientIp, intrusion.category ?? "intrusion");
    await recordExponentialBackoffFailure(AUTH_BACKOFF_SCOPES.suspicious, clientIp);

    scheduleSecurityEventReport(request, {
      event: "IPS_INTRUSION_BLOCKED",
      ip: clientIp,
      path: pathname,
      category: intrusion.category ?? undefined,
      detail: intrusion.matchedPattern ?? undefined,
      userAgent: request.headers.get("user-agent"),
    });

    return createIntrusionBlockedResponse();
  }

  return null;
}

export async function enforceAuthEndpointBackoff(
  request: NextRequest,
  scope: AuthBackoffScope
): Promise<NextResponse | null> {
  const clientIp = getClientIpFromRequest(request);
  const lockout = await checkExponentialBackoff(scope, clientIp);

  if (!lockout.allowed) {
    scheduleSecurityEventReport(request, {
      event: "AUTH_LOCKOUT",
      ip: clientIp,
      path: request.nextUrl.pathname,
      detail: `scope=${scope}`,
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json(
      { error: "Too many attempts. Access temporarily blocked." },
      {
        status: 429,
        headers: {
          "Retry-After": String(lockout.retryAfterSeconds),
        },
      }
    );
  }

  return null;
}

export async function recordAuthEndpointFailure(scope: AuthBackoffScope, ip: string) {
  await recordExponentialBackoffFailure(scope, ip);
}

export { AUTH_BACKOFF_SCOPES };
