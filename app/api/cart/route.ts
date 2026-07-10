import { NextResponse } from "next/server";
import { requireCustomerSession } from "@/lib/api-auth";
import {
  loadUserCartItems,
  mergeGuestCartItems,
  replaceUserCartItems,
} from "@/lib/cart";
import { getUserDiscountPercent } from "@/lib/customer-tier";
import type { OrderCartItem } from "@/types/catalog";

function parseCartItems(body: unknown): Array<{ variantId: number; quantity: number }> | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const candidate = body as Record<string, unknown>;

  if (!Array.isArray(candidate.items)) {
    return null;
  }

  const items = candidate.items
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const row = item as Record<string, unknown>;
      const variantId = Number.parseInt(String(row.id ?? row.variantId ?? ""), 10);
      const quantity = Number(row.quantity);

      if (!Number.isInteger(variantId) || variantId <= 0) {
        return null;
      }

      if (!Number.isInteger(quantity) || quantity <= 0) {
        return null;
      }

      return { variantId, quantity };
    })
    .filter((item): item is { variantId: number; quantity: number } => item !== null);

  return items;
}

export async function GET() {
  const auth = await requireCustomerSession();

  if (auth.response) {
    return auth.response;
  }

  try {
    const user = auth.user!;
    const discountPercent = await getUserDiscountPercent(user.id, user.role);
    const items = await loadUserCartItems(user.id, discountPercent);

    return NextResponse.json({ items });
  } catch (error) {
    console.error("GET /api/cart failed:", error);
    return NextResponse.json({ error: "Failed to load cart" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await requireCustomerSession(request);

  if (auth.response) {
    return auth.response;
  }

  const items = parseCartItems(await request.json());

  if (items === null) {
    return NextResponse.json({ error: "Invalid cart payload" }, { status: 400 });
  }

  try {
    const user = auth.user!;
    await replaceUserCartItems(user.id, items);
    const discountPercent = await getUserDiscountPercent(user.id, user.role);
    const savedItems = await loadUserCartItems(user.id, discountPercent);

    return NextResponse.json({ items: savedItems });
  } catch (error) {
    console.error("PUT /api/cart failed:", error);
    return NextResponse.json({ error: "Failed to save cart" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireCustomerSession(request);

  if (auth.response) {
    return auth.response;
  }

  const body = await request.json();
  const items = parseCartItems(body);

  if (items === null) {
    return NextResponse.json({ error: "Invalid cart payload" }, { status: 400 });
  }

  const merge = Boolean(
    body && typeof body === "object" && (body as Record<string, unknown>).merge === true
  );

  try {
    const user = auth.user!;

    if (merge) {
      await mergeGuestCartItems(user.id, items);
    } else {
      await replaceUserCartItems(user.id, items);
    }

    const discountPercent = await getUserDiscountPercent(user.id, user.role);
    const savedItems = await loadUserCartItems(user.id, discountPercent);

    return NextResponse.json({ items: savedItems });
  } catch (error) {
    console.error("POST /api/cart failed:", error);
    return NextResponse.json({ error: "Failed to sync cart" }, { status: 500 });
  }
}

export type { OrderCartItem };
