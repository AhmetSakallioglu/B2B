export const CUSTOMER_CATALOG_PATH = "/catalog";

export const GUEST_PROTECTED_PAGE_PREFIXES = [
  "/cart",
  "/checkout",
  "/account",
  "/orders",
] as const;

export const GUEST_PROTECTED_API_PREFIXES = [
  "/api/cart",
  "/api/quotes",
  "/api/templates",
  "/api/client-quotes",
  "/api/orders",
  "/api/account",
  "/api/shipping",
] as const;

export function isGuestProtectedPage(pathname: string) {
  if (pathname === "/my-account" || pathname.startsWith("/my-account/")) {
    return true;
  }

  if (pathname === "/quotes" || pathname.startsWith("/quotes/")) {
    return true;
  }

  return GUEST_PROTECTED_PAGE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function resolveGuestProtectedAlias(pathname: string): string | null {
  if (pathname === "/my-account" || pathname.startsWith("/my-account/")) {
    return `/account${pathname.slice("/my-account".length)}`;
  }

  if (pathname === "/quotes") {
    return "/account/quotes";
  }

  if (pathname.startsWith("/quotes/")) {
    return `/account/quotes${pathname.slice("/quotes".length)}`;
  }

  return null;
}

export function isGuestProtectedApi(pathname: string) {
  return GUEST_PROTECTED_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function isAdminPage(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export const PROXY_MATCHER = [
  "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
] as const;
