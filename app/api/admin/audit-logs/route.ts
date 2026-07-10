import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/api-auth";
import { listAuditLogs } from "@/lib/audit-log";

export async function GET() {
  const auth = await requireAdminPermission("can_view_logs");

  if (auth.response) {
    return auth.response;
  }

  try {
    const logs = await listAuditLogs(200);
    return NextResponse.json({ logs });
  } catch (error) {
    console.error("GET /api/admin/audit-logs failed:", error);
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 });
  }
}
