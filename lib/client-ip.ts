import type { NextRequest } from "next/server";

export function getClientIpFromRequest(request: NextRequest | Request): string {
  const forwarded = request.headers.get("x-forwarded-for");

  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }

  const realIp = request.headers.get("x-real-ip")?.trim();

  if (realIp) {
    return realIp;
  }

  const cfConnectingIp = request.headers.get("cf-connecting-ip")?.trim();

  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  return "unknown";
}
