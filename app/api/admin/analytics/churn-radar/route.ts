import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/api-auth";
import { getCachedChurnRadarData } from "@/lib/dashboard-analytics-cache";

export async function GET() {
  const auth = await requireAdminPermission("can_view_churn_radar");

  if (auth.response) {
    return auth.response;
  }

  try {
    const data = await getCachedChurnRadarData();
    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/admin/analytics/churn-radar failed:", error);
    return NextResponse.json({ error: "Failed to load churn radar" }, { status: 500 });
  }
}
