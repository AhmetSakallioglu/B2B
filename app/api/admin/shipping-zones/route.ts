import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/api-auth";
import {
  createShippingZone,
  deleteShippingZone,
  getShippingSettings,
  listShippingZones,
  updateShippingSettings,
  updateShippingZone,
} from "@/lib/shipping-zones";
import {
  logShippingSettingsUpdated,
  logShippingZoneCreated,
  logShippingZoneDeleted,
} from "@/lib/shipping-zones-audit-log";

export async function GET() {
  const auth = await requireAdminPermission("can_manage_shipping_zones");

  if (auth.response) {
    return auth.response;
  }

  const [zones, settings] = await Promise.all([listShippingZones(), getShippingSettings()]);
  return NextResponse.json({ zones, settings });
}

export async function POST(request: Request) {
  const auth = await requireAdminPermission("can_manage_shipping_zones");

  if (auth.response) {
    return auth.response;
  }

  const body = (await request.json()) as {
    zoneName?: unknown;
    basePrice?: unknown;
    zipCodes?: unknown;
    freeShippingThreshold?: unknown;
  };

  const zoneName = typeof body.zoneName === "string" ? body.zoneName : "";
  const zipCodes = typeof body.zipCodes === "string" ? body.zipCodes : "";
  const basePrice =
    typeof body.basePrice === "number"
      ? body.basePrice
      : Number.parseFloat(String(body.basePrice ?? ""));

  const freeShippingThreshold =
    body.freeShippingThreshold === null || body.freeShippingThreshold === ""
      ? null
      : typeof body.freeShippingThreshold === "number"
        ? body.freeShippingThreshold
        : Number.parseFloat(String(body.freeShippingThreshold ?? ""));

  try {
    const zone = await createShippingZone({
      zoneName,
      basePrice,
      zipCodesInput: zipCodes,
      freeShippingThreshold,
    });

    await logShippingZoneCreated({
      adminUserId: auth.user!.id,
      zone,
    });

    return NextResponse.json({ ok: true, zone }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create shipping zone" },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdminPermission("can_manage_shipping_zones");

  if (auth.response) {
    return auth.response;
  }

  const body = (await request.json()) as {
    defaultOutOfZoneRate?: unknown;
  };

  if (body.defaultOutOfZoneRate === undefined) {
    return NextResponse.json({ error: "No settings to update" }, { status: 400 });
  }

  const defaultOutOfZoneRate =
    typeof body.defaultOutOfZoneRate === "number"
      ? body.defaultOutOfZoneRate
      : Number.parseFloat(String(body.defaultOutOfZoneRate ?? ""));

  try {
    const currentSettings = await getShippingSettings();
    const settings = await updateShippingSettings({ defaultOutOfZoneRate });

    if (currentSettings.defaultOutOfZoneRate !== settings.defaultOutOfZoneRate) {
      await logShippingSettingsUpdated({
        adminUserId: auth.user!.id,
        oldDefaultOutOfZoneRate: currentSettings.defaultOutOfZoneRate,
        newDefaultOutOfZoneRate: settings.defaultOutOfZoneRate,
      });
    }

    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update shipping settings" },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdminPermission("can_manage_shipping_zones");

  if (auth.response) {
    return auth.response;
  }

  const body = (await request.json()) as { zoneId?: unknown };
  const zoneId = typeof body.zoneId === "string" ? body.zoneId.trim() : "";

  if (!zoneId) {
    return NextResponse.json({ error: "Zone id is required" }, { status: 400 });
  }

  try {
    const zone = await deleteShippingZone(zoneId);

    await logShippingZoneDeleted({
      adminUserId: auth.user!.id,
      zone,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete shipping zone" },
      { status: 400 }
    );
  }
}
