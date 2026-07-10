import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/api-auth";
import { getQuoteForAdmin, logQuoteAdminView } from "@/lib/quotes";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("can_manage_quotes");

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const quoteId = Number.parseInt(id, 10);

  if (Number.isNaN(quoteId)) {
    return NextResponse.json({ error: "Invalid quote id" }, { status: 400 });
  }

  try {
    const quote = await getQuoteForAdmin(quoteId);

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    await logQuoteAdminView({
      adminUserId: auth.user!.id,
      quoteId: quote.id,
      quoteName: quote.quoteName,
      customerEmail: quote.customerEmail,
    });

    return NextResponse.json({ quote });
  } catch (error) {
    console.error("GET /api/admin/quotes/[id] failed:", error);
    return NextResponse.json({ error: "Failed to load quote" }, { status: 500 });
  }
}
