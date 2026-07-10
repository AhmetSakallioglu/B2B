import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { parseSanitizedDashboardDateRange } from "@/lib/admin-search-sanitization";
import { parseDashboardDateRange } from "@/lib/admin-dashboard-stats";
import { loadAdminCommandCenterData } from "@/lib/admin-command-center";
import {
  ADMIN_PERMISSION_KEYS,
  hasAnyAdminPermission,
  PERMISSION_FORBIDDEN_MESSAGE,
} from "@/types/admin-permissions";

export async function GET(request: Request) {
  const auth = await requireAdmin();

  if (auth.response) {
    return auth.response;
  }

  if (!hasAnyAdminPermission(auth.permissions!, [...ADMIN_PERMISSION_KEYS])) {
    return NextResponse.json({ error: PERMISSION_FORBIDDEN_MESSAGE }, { status: 403 });
  }

  try {
    const searchParams = new URL(request.url).searchParams;
    const sanitizedDates = await parseSanitizedDashboardDateRange(
      request,
      searchParams,
      auth.user!.id
    );

    if (sanitizedDates.blocked) {
      return sanitizedDates.blocked;
    }

    const range = parseDashboardDateRange(searchParams, {
      startDate: sanitizedDates.startDate,
      endDate: sanitizedDates.endDate,
    });

    const dashboard = await loadAdminCommandCenterData(range);
    return NextResponse.json(dashboard, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/admin/dashboard failed:", error);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}
