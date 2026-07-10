import { NextResponse } from "next/server";
import { cleanupAuditLogsOlderThanDays } from "@/lib/admin-audit-log";
import { isAuthorizedCron } from "@/lib/cron-auth";

const RETENTION_DAYS = 30;

async function runCleanup() {
  const deletedCount = await cleanupAuditLogsOlderThanDays(RETENTION_DAYS);

  return NextResponse.json({
    success: true,
    deletedCount,
    retentionDays: RETENTION_DAYS,
  });
}

export async function POST(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return await runCleanup();
  } catch (error) {
    console.error("POST /api/cron/cleanup-logs failed:", error);
    return NextResponse.json({ error: "Failed to clean up audit logs" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return await runCleanup();
  } catch (error) {
    console.error("GET /api/cron/cleanup-logs failed:", error);
    return NextResponse.json({ error: "Failed to clean up audit logs" }, { status: 500 });
  }
}
