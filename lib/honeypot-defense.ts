import type { HoneypotHitEvent } from "@/types/active-defense";

export const HONEYPOT_PATH_PREFIXES = [
  "/wp-admin",
  "/wp-login.php",
  "/.env",
  "/.git",
  "/phpmyadmin",
  "/xmlrpc.php",
  "/administrator",
  "/api/cart/bulk-upload",
] as const;

export const HONEYPOT_EXACT_PATHS = new Set<string>([
  "/wp-login.php",
  "/.env",
  "/xmlrpc.php",
  "/server-status",
  "/config.php",
]);

export function isHoneypotPath(pathname: string) {
  const normalized = pathname.toLowerCase();

  if (HONEYPOT_EXACT_PATHS.has(normalized)) {
    return true;
  }

  if (normalized === "/admin/.git" || normalized.startsWith("/admin/.git/")) {
    return true;
  }

  return HONEYPOT_PATH_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
  );
}

export function describeHoneypotHit(event: HoneypotHitEvent) {
  return `Honeypot access on ${event.path}`;
}
