import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/api-auth";
import { restoreAuditLogEntry } from "@/lib/audit-log";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("can_restore_logs");

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const logId = Number.parseInt(id, 10);

  if (Number.isNaN(logId)) {
    return NextResponse.json({ error: "Invalid audit log id" }, { status: 400 });
  }

  try {
    const result = await restoreAuditLogEntry(logId, auth.user!.id);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/admin/audit-logs/[id]/restore failed:", error);
    return NextResponse.json({ error: "Failed to restore audit log entry" }, { status: 500 });
  }
}
