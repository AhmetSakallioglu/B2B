import { NextResponse } from "next/server";
import { requireCustomerSession } from "@/lib/api-auth";
import { replaceUserCartItems } from "@/lib/cart";
import { getUnavailableVariantIds } from "@/lib/cart-validation";
import {
  getClientQuoteForUser,
  markClientQuoteConverted,
} from "@/lib/client-quotes";
import { databaseSetupHint } from "@/lib/db-setup-hints";
import { enforceMutationSecurity } from "@/lib/request-security";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const mutationBlocked = enforceMutationSecurity(request);

  if (mutationBlocked) {
    return mutationBlocked;
  }

  const auth = await requireCustomerSession(request);

  if (auth.response) {
    return auth.response;
  }

  const userId = auth.user!.id;
  const { id } = await context.params;
  const quoteId = Number.parseInt(id, 10);

  if (!Number.isFinite(quoteId) || quoteId <= 0) {
    return NextResponse.json({ error: "Invalid quote id" }, { status: 400 });
  }

  try {
    const quote = await getClientQuoteForUser(quoteId, userId);

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    if (quote.items.length === 0) {
      return NextResponse.json({ error: "Quote has no items" }, { status: 400 });
    }

    const variantIds = quote.items.map((item) => item.variant_id);
    const missingVariants = await getUnavailableVariantIds(variantIds);

    if (missingVariants.length > 0) {
      return NextResponse.json(
        {
          error:
            "Some products in this quote are no longer available. Update the quote or contact support.",
        },
        { status: 400 }
      );
    }

    const cartItems = quote.items.map((item) => ({
      variantId: item.variant_id,
      quantity: item.quantity,
    }));

    await replaceUserCartItems(userId, cartItems);
    await markClientQuoteConverted(quoteId, userId);

    return NextResponse.json({
      ok: true,
      redirectTo: "/cart",
      itemCount: cartItems.length,
    });
  } catch (error) {
    console.error(`POST /api/client-quotes/${quoteId}/convert-to-cart failed:`, error);

    const hint = databaseSetupHint(error);
    const message =
      error instanceof Error && error.message
        ? `${error.message}${hint}`
        : `Failed to convert quote to cart.${hint}`;

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
