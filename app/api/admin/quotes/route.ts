import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/api-auth";
import { listQuotesForAdmin } from "@/lib/quotes";

export async function GET() {
  const auth = await requireAdminPermission("can_manage_quotes");

  if (auth.response) {
    return auth.response;
  }

  try {
    const quotes = await listQuotesForAdmin();
    return NextResponse.json({ quotes });
  } catch (error) {
    console.error("GET /api/admin/quotes failed:", error);
    return NextResponse.json({ error: "Failed to load quotes" }, { status: 500 });
  }
}
