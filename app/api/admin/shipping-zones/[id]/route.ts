import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/api-auth";
import { getShippingZoneById, updateShippingZone } from "@/lib/shipping-zones";
import { logShippingZoneUpdated } from "@/lib/shipping-zones-audit-log";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("can_manage_shipping_zones");

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const body = (await request.json()) as {
    zoneName?: unknown;
    basePrice?: unknown;
    zipCodes?: unknown;
    freeShippingThreshold?: unknown;
  };

  const existing = await getShippingZoneById(id);

  if (!existing) {
    return NextResponse.json({ error: "Shipping zone not found" }, { status: 404 });
  }

  try {
    const zone = await updateShippingZone(id, {
      ...(typeof body.zoneName === "string" ? { zoneName: body.zoneName } : {}),
      ...(body.basePrice !== undefined
        ? {
            basePrice:
              typeof body.basePrice === "number"
                ? body.basePrice
                : Number.parseFloat(String(body.basePrice ?? "")),
          }
        : {}),
      ...(typeof body.zipCodes === "string" ? { zipCodesInput: body.zipCodes } : {}),
      ...(body.freeShippingThreshold !== undefined
        ? {
            freeShippingThreshold:
              body.freeShippingThreshold === null || body.freeShippingThreshold === ""
                ? null
                : typeof body.freeShippingThreshold === "number"
                  ? body.freeShippingThreshold
                  : Number.parseFloat(String(body.freeShippingThreshold ?? "")),
          }
        : {}),
    });

    await logShippingZoneUpdated({
      adminUserId: auth.user!.id,
      oldZone: existing,
      newZone: zone,
    });

    return NextResponse.json({ ok: true, zone });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update shipping zone" },
      { status: 400 }
    );
  }
}
