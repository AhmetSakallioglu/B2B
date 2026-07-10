import { NextResponse } from "next/server";
import { requireCustomerSession } from "@/lib/api-auth";
import { getVariantAvailabilityMap } from "@/lib/cart-validation";

function parseVariantIds(body: unknown): number[] | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const candidate = body as Record<string, unknown>;
  const rawIds = candidate.variantIds ?? candidate.ids;

  if (!Array.isArray(rawIds)) {
    return null;
  }

  const variantIds = rawIds
    .map((value) => Number.parseInt(String(value), 10))
    .filter((id) => Number.isInteger(id) && id > 0);

  return variantIds;
}

const MAX_VARIANT_IDS = 200;

export async function POST(request: Request) {
  const auth = await requireCustomerSession(request);

  if (auth.response) {
    return auth.response;
  }

  try {
    const variantIds = parseVariantIds(await request.json());

    if (variantIds === null) {
      return NextResponse.json({ error: "Invalid validation payload" }, { status: 400 });
    }

    if (variantIds.length > MAX_VARIANT_IDS) {
      return NextResponse.json(
        { error: `At most ${MAX_VARIANT_IDS} variant ids per request` },
        { status: 400 }
      );
    }

    if (variantIds.length === 0) {
      return NextResponse.json({ availability: {} });
    }

    const availabilityMap = await getVariantAvailabilityMap(variantIds);
    const availability: Record<string, boolean> = {};

    for (const id of variantIds) {
      availability[String(id)] = availabilityMap.get(id) === true;
    }

    return NextResponse.json({ availability });
  } catch (error) {
    console.error("POST /api/cart/validate failed:", error);
    return NextResponse.json(
      { error: "Failed to validate cart items" },
      { status: 500 }
    );
  }
}
