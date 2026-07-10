import { NextResponse } from "next/server";
import { requireCustomerSession } from "@/lib/api-auth";
import { createQuote, logQuoteCreated } from "@/lib/quotes";
import { parseSaveQuoteBody } from "@/lib/quote-validation";
import { resolveServerCartPricing } from "@/lib/server-cart-pricing";

export async function POST(request: Request) {
  const auth = await requireCustomerSession(request);

  if (auth.response) {
    return auth.response;
  }

  try {
    const body = parseSaveQuoteBody(await request.json());

    if (!body) {
      return NextResponse.json({ error: "Invalid quote payload" }, { status: 400 });
    }

    const pricing = await resolveServerCartPricing({
      items: body.items,
      userId: auth.user!.id,
      userRole: auth.user!.role,
      requireAvailability: false,
    });

    if ("error" in pricing) {
      return NextResponse.json({ error: pricing.error }, { status: pricing.status });
    }

    const quote = await createQuote({
      userId: auth.user!.id,
      quoteName: body.quoteName,
      items: pricing.items,
      totalAmount: pricing.totalAmount,
    });

    await logQuoteCreated({
      userId: auth.user!.id,
      quoteId: quote.id,
      quoteName: quote.quoteName,
      totalAmount: quote.totalAmount,
      itemCount: quote.items.reduce((count, item) => count + item.quantity, 0),
    });

    return NextResponse.json({ quote }, { status: 201 });
  } catch (error) {
    console.error("POST /api/quotes/save failed:", error);
    return NextResponse.json({ error: "Failed to save quote" }, { status: 500 });
  }
}
