import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/api-auth";
import { listAllClientQuotesForAdmin } from "@/lib/client-quotes";
import { databaseSetupHint } from "@/lib/db-setup-hints";

export async function GET() {
  const auth = await requireAdminPermission("can_view_orders");

  if (auth.response) {
    return auth.response;
  }

  try {
    const quotes = await listAllClientQuotesForAdmin();
    return NextResponse.json({ quotes });
  } catch (error) {
    console.error("GET /api/admin/client-quotes failed:", error);

    const hint = databaseSetupHint(error);
    const message =
      error instanceof Error && error.message
        ? `${error.message}${hint}`
        : `Failed to load dealer client quotes.${hint}`;

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
