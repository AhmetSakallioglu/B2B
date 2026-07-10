import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { AUTH_COOKIE_NAME } from "@/lib/auth-constants";
import { validateMutationOriginFromHeaders } from "@/lib/mutation-origin";
import {
  AUTH_BACKOFF_SCOPES,
  enforceActiveDefense,
  enforceAuthEndpointBackoff,
} from "@/lib/active-defense-edge";
import {
  isAdminPage,
  isGuestProtectedApi,
  isGuestProtectedPage,
  resolveGuestProtectedAlias,
} from "@/lib/route-guard";
import { resolveEdgeSessionValidity } from "@/lib/edge-security-batch";
import {
  buildEdgeSessionResolution,
  isProtectedAccessPath,
  shouldValidateSessionAtEdge,
  unauthorizedPagePath,
} from "@/lib/zero-trust-access";
import type { EdgeSessionContext } from "@/types/zero-trust";

const AUTH_RATE_LIMITS = {
  login: AUTH_BACKOFF_SCOPES.login,
  register: AUTH_BACKOFF_SCOPES.register,
  credentials: AUTH_BACKOFF_SCOPES.credentials,
  cartValidate: AUTH_BACKOFF_SCOPES.cartValidate,
} as const;

function isInternalSecurityPath(pathname: string) {
  return pathname.startsWith("/api/internal/security-event");
}

function isWebhookPath(pathname: string) {
  return pathname.startsWith("/api/webhooks/");
}

function validateMutationOrigin(request: NextRequest) {
  return validateMutationOriginFromHeaders(
    request.method,
    request.headers.get("host"),
    request.headers.get("origin"),
    request.headers.get("referer")
  );
}

function applySecurityHeaders(response: NextResponse) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("X-DNS-Prefetch-Control", "off");

  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }

  return response;
}

function getAuthSecretKey() {
  const secret = process.env.AUTH_SECRET;

  if (!secret || secret.length < 32) {
    return null;
  }

  return new TextEncoder().encode(secret);
}

async function readSessionContext(request: NextRequest): Promise<EdgeSessionContext | null> {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const secret = getAuthSecretKey();

  if (!token || !secret) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, secret);

    if (typeof payload.role !== "string") {
      return null;
    }

    if (payload.role !== "customer" && payload.role !== "admin") {
      return null;
    }

    const userId = Number(payload.sub);
    const sessionVersion =
      typeof payload.sv === "number" && Number.isInteger(payload.sv) && payload.sv > 0
        ? payload.sv
        : null;

    if (!payload.sub || Number.isNaN(userId) || !sessionVersion) {
      return null;
    }

    return {
      role: payload.role,
      userId,
      sessionVersion,
    };
  } catch {
    return null;
  }
}

async function validateSessionAtEdge(
  request: NextRequest,
  session: EdgeSessionContext
): Promise<boolean> {
  const pipelinedResult = await resolveEdgeSessionValidity(session);

  if (pipelinedResult !== null) {
    return pipelinedResult;
  }

  const validateUrl = new URL("/api/auth/validate-session", request.url);

  try {
    const response = await fetch(validateUrl.toString(), {
      headers: {
        cookie: request.headers.get("cookie") ?? "",
      },
      cache: "no-store",
    });

    return response.ok;
  } catch {
    return false;
  }
}

function getClearSessionCookieOptions() {
  return {
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: 0,
  };
}

function withClearedSessionCookie(response: NextResponse) {
  response.cookies.set(getClearSessionCookieOptions());
  return response;
}

function maybeClearSessionCookie(response: NextResponse, shouldClearCookie: boolean) {
  return shouldClearCookie ? withClearedSessionCookie(response) : response;
}

function redirectToLogin(request: NextRequest, pathname: string, shouldClearCookie: boolean) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("redirect", pathname);
  return applySecurityHeaders(
    maybeClearSessionCookie(NextResponse.redirect(loginUrl), shouldClearCookie)
  );
}

function redirectToUnauthorized(request: NextRequest) {
  return applySecurityHeaders(
    NextResponse.redirect(new URL(unauthorizedPagePath(), request.url))
  );
}

function redirectCustomersFromAdminRoutes(request: NextRequest) {
  return redirectToUnauthorized(request);
}

function redirectAdminsFromCustomerRoutes(request: NextRequest) {
  return applySecurityHeaders(NextResponse.redirect(new URL("/admin", request.url)));
}

async function resolveEdgeSession(
  request: NextRequest,
  pathname: string
): Promise<{ session: EdgeSessionContext | null; shouldClearCookie: boolean }> {
  const hadSessionToken = Boolean(request.cookies.get(AUTH_COOKIE_NAME)?.value);
  const session = await readSessionContext(request);

  if (!session) {
    return { session: null, shouldClearCookie: false };
  }

  if (!shouldValidateSessionAtEdge(pathname)) {
    return { session, shouldClearCookie: false };
  }

  const isValid = await validateSessionAtEdge(request, session);

  return buildEdgeSessionResolution(session, isValid, hadSessionToken);
}

function attachInvokeHeaders(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-invoke-method", request.method);
  requestHeaders.set("x-invoke-pathname", request.nextUrl.pathname);

  return requestHeaders;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isInternalSecurityPath(pathname)) {
    const activeDefenseBlocked = await enforceActiveDefense(request);

    if (activeDefenseBlocked) {
      return activeDefenseBlocked;
    }
  }

  const aliasTarget = resolveGuestProtectedAlias(pathname);

  if (aliasTarget) {
    const aliasUrl = new URL(aliasTarget, request.url);
    aliasUrl.search = request.nextUrl.search;
    return applySecurityHeaders(NextResponse.redirect(aliasUrl));
  }

  if (pathname.startsWith("/api/")) {
    if (!isWebhookPath(pathname) && !validateMutationOrigin(request)) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Forbidden" }, { status: 403 })
      );
    }

    if (pathname === "/api/auth/login" && request.method === "POST") {
      const backoffBlocked = await enforceAuthEndpointBackoff(
        request,
        AUTH_RATE_LIMITS.login
      );

      if (backoffBlocked) {
        return applySecurityHeaders(backoffBlocked);
      }
    }

    if (pathname === "/api/auth/register" && request.method === "POST") {
      const backoffBlocked = await enforceAuthEndpointBackoff(
        request,
        AUTH_RATE_LIMITS.register
      );

      if (backoffBlocked) {
        return applySecurityHeaders(backoffBlocked);
      }
    }

    if (pathname === "/api/account/credentials" && request.method === "PATCH") {
      const backoffBlocked = await enforceAuthEndpointBackoff(
        request,
        AUTH_RATE_LIMITS.credentials
      );

      if (backoffBlocked) {
        return applySecurityHeaders(backoffBlocked);
      }
    }

    if (pathname === "/api/cart/validate" && request.method === "POST") {
      const backoffBlocked = await enforceAuthEndpointBackoff(
        request,
        AUTH_RATE_LIMITS.cartValidate
      );

      if (backoffBlocked) {
        return applySecurityHeaders(backoffBlocked);
      }
    }

    const { session, shouldClearCookie } = await resolveEdgeSession(request, pathname);
    const role = session?.role ?? null;
    const protectedPath = isProtectedAccessPath(pathname);

    if (protectedPath && !role) {
      return applySecurityHeaders(
        maybeClearSessionCookie(
          NextResponse.json({ error: "Authentication required" }, { status: 401 }),
          shouldClearCookie
        )
      );
    }

    if (isGuestProtectedApi(pathname)) {
      if (role === "admin") {
        return applySecurityHeaders(
          NextResponse.json({ error: "Customer account required" }, { status: 403 })
        );
      }
    }

    if (pathname.startsWith("/api/admin")) {
      if (role !== "admin") {
        return applySecurityHeaders(
          maybeClearSessionCookie(
            NextResponse.json({ error: "Admin access required" }, { status: 403 }),
            shouldClearCookie
          )
        );
      }
    }

    return applySecurityHeaders(
      maybeClearSessionCookie(
        NextResponse.next({
          request: {
            headers: attachInvokeHeaders(request),
          },
        }),
        shouldClearCookie && !protectedPath
      )
    );
  }

  const { session, shouldClearCookie } = await resolveEdgeSession(request, pathname);
  const role = session?.role ?? null;

  if (isAdminPage(pathname)) {
    if (!role) {
      return redirectToLogin(request, pathname, shouldClearCookie);
    }

    if (role !== "admin") {
      return redirectCustomersFromAdminRoutes(request);
    }
  }

  if (isGuestProtectedPage(pathname)) {
    if (!role) {
      return redirectToLogin(request, pathname, shouldClearCookie);
    }

    if (role === "admin") {
      return redirectAdminsFromCustomerRoutes(request);
    }
  }

  return applySecurityHeaders(
    maybeClearSessionCookie(
      NextResponse.next({
        request: {
          headers: attachInvokeHeaders(request),
        },
      }),
      shouldClearCookie
    )
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
