import { NextResponse } from "next/server";
import { requireCustomerSession } from "@/lib/api-auth";
import { databaseSetupHint } from "@/lib/db-setup-hints";
import { checkQuotePriceFreshness } from "@/lib/quote-price-freshness";
import { getQuoteForUser, setQuoteArchivedForUser } from "@/lib/quotes";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseQuoteId(id: string) {
  const quoteId = Number.parseInt(id, 10);
  return Number.isInteger(quoteId) && quoteId > 0 ? quoteId : null;
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireCustomerSession();

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const quoteId = parseQuoteId(id);

  if (!quoteId) {
    return NextResponse.json({ error: "Invalid quote id" }, { status: 400 });
  }

  try {
    const quote = await getQuoteForUser(quoteId, auth.user!.id);

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    const freshness = await checkQuotePriceFreshness({
      savedItems: quote.items,
      savedTotalAmount: quote.totalAmount,
      userId: auth.user!.id,
      userRole: auth.user!.role,
    });

    if (!freshness.priceChanged) {
      return NextResponse.json({ quote });
    }

    return NextResponse.json({
      quote: {
        ...quote,
        items: freshness.updatedItems,
        totalAmount: freshness.newTotalAmount,
      },
      price_changed: true,
      old_total_amount: freshness.oldTotalAmount,
      new_total_amount: freshness.newTotalAmount,
      changed_items: freshness.changedItems,
    });
  } catch (error) {
    console.error("GET /api/quotes/[id] failed:", error);
    return NextResponse.json({ error: "Failed to load quote" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireCustomerSession(request);

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const quoteId = parseQuoteId(id);

  if (!quoteId) {
    return NextResponse.json({ error: "Invalid quote id" }, { status: 400 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid quote payload" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || typeof (body as { archived?: unknown }).archived !== "boolean") {
    return NextResponse.json({ error: "Invalid quote payload" }, { status: 400 });
  }

  try {
    const quote = await setQuoteArchivedForUser({
      quoteId,
      userId: auth.user!.id,
      archived: (body as { archived: boolean }).archived,
    });

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    return NextResponse.json({ quote });
  } catch (error) {
    console.error("PATCH /api/quotes/[id] failed:", error);
    const hint = databaseSetupHint(error);
    return NextResponse.json(
      { error: hint.trim() ? `Failed to update quote.${hint}` : "Failed to update quote" },
      { status: 500 }
    );
  }
}
