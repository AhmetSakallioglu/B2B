import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import {
  createShippingAddress,
  listShippingAddresses,
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

export async function GET() {
  const auth = await requireSession();

  if (auth.response) {
    return auth.response;
  }

  if (auth.user!.role === "admin" && !auth.user!.impersonatedBy) {
    return NextResponse.json({ error: "Admin accounts cannot manage shipping addresses" }, { status: 403 });
  }

  const addresses = await listShippingAddresses(auth.user!.id);
  return NextResponse.json({ addresses });
}

export async function POST(request: Request) {
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

  try {
    const address = await createShippingAddress(auth.user!.id, body);
    return NextResponse.json({ ok: true, address }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save address" },
      { status: 400 }
    );
  }
}
