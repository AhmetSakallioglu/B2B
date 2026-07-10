import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { validateMutationOriginFromHeaders } from "@/lib/mutation-origin";
import { isMutationMethod } from "@/lib/mutation-origin";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const rateLimitBuckets = new Map<string, RateLimitBucket>();

const MUTATION_SECURITY_SKIP_PREFIXES = ["/api/cron/", "/api/webhooks/"] as const;

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");

  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function validateMutationOrigin(request: Request): boolean {
  return validateMutationOriginFromHeaders(
    request.method,
    request.headers.get("host"),
    request.headers.get("origin"),
    request.headers.get("referer")
  );
}

export function rejectUnsafeMutation(request: Request): NextResponse | null {
  if (!isMutationMethod(request.method)) {
    return null;
  }

  if (validateMutationOrigin(request)) {
    return null;
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export function enforceMutationSecurity(request: Request): NextResponse | null {
  const pathname = new URL(request.url).pathname;

  if (MUTATION_SECURITY_SKIP_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  return rejectUnsafeMutation(request);
}

export async function enforceMutationSecurityFromContext(): Promise<NextResponse | null> {
  const headerList = await headers();
  const method = headerList.get("x-invoke-method")?.toUpperCase() ?? "";

  if (!method || !isMutationMethod(method)) {
    return null;
  }

  const pathname = headerList.get("x-invoke-pathname") ?? "";

  if (MUTATION_SECURITY_SKIP_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  if (
    !validateMutationOriginFromHeaders(
      method,
      headerList.get("host"),
      headerList.get("origin"),
      headerList.get("referer")
    )
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  rateLimitBuckets.set(key, bucket);

  return { allowed: true, retryAfterSeconds: 0 };
}

export function rateLimitResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
      },
    }
  );
}
