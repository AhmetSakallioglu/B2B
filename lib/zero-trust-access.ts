import {
  isAdminPage,
  isGuestProtectedApi,
  isGuestProtectedPage,
} from "@/lib/route-guard";
import type { EdgeSessionResolution } from "@/types/zero-trust";

const EDGE_SESSION_VALIDATION_SKIP_PREFIXES = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/logout",
  "/api/cron/",
  "/api/webhooks/",
] as const;

export function shouldValidateSessionAtEdge(pathname: string) {
  if (pathname.startsWith("/api/auth/validate-session")) {
    return false;
  }

  return !EDGE_SESSION_VALIDATION_SKIP_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );
}

export function isProtectedAccessPath(pathname: string) {
  return (
    isAdminPage(pathname) ||
    isGuestProtectedPage(pathname) ||
    isGuestProtectedApi(pathname) ||
    pathname.startsWith("/api/admin")
  );
}

export function unauthorizedPagePath() {
  return "/403-unauthorized";
}

export function buildEdgeSessionResolution(
  session: EdgeSessionResolution["session"],
  isValid: boolean,
  hadSessionToken: boolean
): EdgeSessionResolution {
  if (!session) {
    return { session: null, shouldClearCookie: false };
  }

  if (isValid) {
    return { session, shouldClearCookie: false };
  }

  return { session: null, shouldClearCookie: hadSessionToken };
}
