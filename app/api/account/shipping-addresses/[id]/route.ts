import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import {
  deleteShippingAddress,
  getShippingAddressForUser,
  updateShippingAddress,
} from "@/lib/shipping-addresses";
import type { ShippingAddressInput } from "@/types/shipping-address";

function parseAddressBody(body: unknown): ShippingAddressInput | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const candidate = body as Record<string, unknown>;

  if (typeof candidate.addressTitle !== "string" || typeof candidate.streetAddress !== "string") {
    return null;
  }

  if (typeof candidate.city !== "string" || typeof candidate.zipCode !== "string") {
    return null;
  }

  return {
    addressTitle: candidate.addressTitle,
    streetAddress: candidate.streetAddress,
    city: candidate.city,
    state: typeof candidate.state === "string" ? candidate.state : "TX",
    zipCode: candidate.zipCode,
    contactPerson:
      typeof candidate.contactPerson === "string" ? candidate.contactPerson : null,
    contactPhone: typeof candidate.contactPhone === "string" ? candidate.contactPhone : null,
  };
}

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireSession();

  if (auth.response) {
    return auth.response;
  }

  if (auth.user!.role === "admin" && !auth.user!.impersonatedBy) {
    return NextResponse.json({ error: "Admin accounts cannot manage shipping addresses" }, { status: 403 });
  }

  const { id } = await context.params;
  const address = await getShippingAddressForUser(auth.user!.id, id);

  if (!address) {
    return NextResponse.json({ error: "Shipping address not found" }, { status: 404 });
  }

  return NextResponse.json({ address });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireSession(request);

  if (auth.response) {
    return auth.response;
  }

  if (auth.user!.role === "admin" && !auth.user!.impersonatedBy) {
    return NextResponse.json({ error: "Admin accounts cannot manage shipping addresses" }, { status: 403 });
  }

  const body = parseAddressBody(await request.json());

  if (!body) {
    return NextResponse.json({ error: "Invalid address payload" }, { status: 400 });
  }

  const { id } = await context.params;

  try {
    const address = await updateShippingAddress(auth.user!.id, id, body);
    return NextResponse.json({ ok: true, address });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update address" },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireSession(request);

  if (auth.response) {
    return auth.response;
  }

  if (auth.user!.role === "admin" && !auth.user!.impersonatedBy) {
    return NextResponse.json({ error: "Admin accounts cannot manage shipping addresses" }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    await deleteShippingAddress(auth.user!.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete address" },
      { status: 400 }
    );
  }
}
