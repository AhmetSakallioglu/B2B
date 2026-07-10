import { NextResponse } from "next/server";
import { requireCustomerSession } from "@/lib/api-auth";
import { checkQuotePriceFreshness } from "@/lib/quote-price-freshness";
import { getQuoteForUser } from "@/lib/quotes";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireCustomerSession();

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const quoteId = Number.parseInt(id, 10);

  if (Number.isNaN(quoteId)) {
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
