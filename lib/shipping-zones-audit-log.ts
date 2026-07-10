import { writeAuditLog } from "@/lib/audit-log";
import type { ShippingZone } from "@/types/shipping-zone";

function snapshotZone(zone: ShippingZone) {
  return {
    shipping_zone_id: zone.id,
    zone_name: zone.zoneName,
    base_price: zone.basePrice,
    zip_codes: zone.zipCodes,
    free_shipping_threshold: zone.freeShippingThreshold,
  };
}

export async function logShippingZoneCreated(params: {
  adminUserId: number;
  zone: ShippingZone;
}) {
  await writeAuditLog({
    userId: params.adminUserId,
    action: "CREATE",
    tableName: "shipping_zones",
    recordId: 0,
    newValues: {
      ...snapshotZone(params.zone),
      summary: `Created shipping zone "${params.zone.zoneName}" (${params.zone.zipCodes.length} ZIP code(s), $${params.zone.basePrice.toFixed(2)} base rate).`,
    },
  });
}

export async function logShippingZoneUpdated(params: {
  adminUserId: number;
  oldZone: ShippingZone;
  newZone: ShippingZone;
}) {
  await writeAuditLog({
    userId: params.adminUserId,
    action: "UPDATE",
    tableName: "shipping_zones",
    recordId: 0,
    oldValues: snapshotZone(params.oldZone),
    newValues: {
      ...snapshotZone(params.newZone),
      summary: `Updated shipping zone "${params.newZone.zoneName}".`,
    },
  });
}

export async function logShippingZoneDeleted(params: {
  adminUserId: number;
  zone: ShippingZone;
}) {
  await writeAuditLog({
    userId: params.adminUserId,
    action: "SOFT_DELETE",
    tableName: "shipping_zones",
    recordId: 0,
    oldValues: snapshotZone(params.zone),
    newValues: {
      shipping_zone_id: params.zone.id,
      summary: `Deleted shipping zone "${params.zone.zoneName}".`,
    },
  });
}

export async function logShippingSettingsUpdated(params: {
  adminUserId: number;
  oldDefaultOutOfZoneRate: number;
  newDefaultOutOfZoneRate: number;
}) {
  await writeAuditLog({
    userId: params.adminUserId,
    action: "UPDATE",
    tableName: "shipping_zones",
    recordId: 0,
    oldValues: {
      default_out_of_zone_rate: params.oldDefaultOutOfZoneRate,
    },
    newValues: {
      default_out_of_zone_rate: params.newDefaultOutOfZoneRate,
      summary: `Updated default out-of-zone shipping rate from $${params.oldDefaultOutOfZoneRate.toFixed(2)} to $${params.newDefaultOutOfZoneRate.toFixed(2)}.`,
    },
  });
}
