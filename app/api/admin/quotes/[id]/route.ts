import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/api-auth";
import { databaseSetupHint } from "@/lib/db-setup-hints";
import { parseQuoteAdminDiscountPercent } from "@/lib/quote-validation";
import { getQuoteForAdmin, logQuoteAdminView, setQuoteAdminDiscount } from "@/lib/quotes";

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
    const hint = databaseSetupHint(error);
    return NextResponse.json(
      { error: hint.trim() ? `Failed to load quote.${hint}` : "Failed to load quote" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("can_manage_quotes", request);

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const quoteId = Number.parseInt(id, 10);

  if (Number.isNaN(quoteId)) {
    return NextResponse.json({ error: "Invalid quote id" }, { status: 400 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid quote payload" }, { status: 400 });
  }

  const discountPercent = parseQuoteAdminDiscountPercent(
    body && typeof body === "object"
      ? (body as { discountPercent?: unknown }).discountPercent
      : undefined
  );

  if (discountPercent === null) {
    return NextResponse.json({ error: "Discount must be between 0 and 100" }, { status: 400 });
  }

  try {
    const quote = await setQuoteAdminDiscount({
      quoteId,
      adminUserId: auth.user!.id,
      discountPercent,
    });

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    return NextResponse.json({ quote });
  } catch (error) {
    console.error("PATCH /api/admin/quotes/[id] failed:", error);
    const hint = databaseSetupHint(error);
    return NextResponse.json(
      { error: hint.trim() ? `Failed to update quote.${hint}` : "Failed to update quote" },
      { status: 500 }
    );
  }
}
