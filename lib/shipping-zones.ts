import { query } from "@/lib/db";
import { sanitizePlainText } from "@/lib/input-sanitization";
import { roundCurrency } from "@/lib/pricing";
import type { ShippingQuote, ShippingSettings, ShippingZone, ShippingZoneRow } from "@/types/shipping-zone";

export const DEFAULT_OUT_OF_ZONE_SHIPPING_RATE = 500;

const OUT_OF_ZONE_NOTICE =
  "This ZIP is outside our standard delivery zones. A default long-distance shipping rate applies. Please contact us for a custom shipping quote if needed.";

import { parseZipCodesInput, normalizeShippingZip } from "@/lib/shipping-zip";

function mapShippingZoneRow(row: ShippingZoneRow): ShippingZone {
  return {
    id: row.id,
    zoneName: row.zone_name,
    basePrice: Number.parseFloat(row.base_price),
    zipCodes: row.zip_codes,
    freeShippingThreshold:
      row.free_shipping_threshold === null
        ? null
        : Number.parseFloat(row.free_shipping_threshold),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function getShippingSettings(): Promise<ShippingSettings> {
  const result = await query<{ default_out_of_zone_rate: string }>(
    `SELECT default_out_of_zone_rate FROM shipping_settings WHERE id = 1`
  );

  const rate = result.rows[0]?.default_out_of_zone_rate;

  return {
    defaultOutOfZoneRate:
      rate !== undefined ? Number.parseFloat(rate) : DEFAULT_OUT_OF_ZONE_SHIPPING_RATE,
  };
}

export async function listShippingZones(): Promise<ShippingZone[]> {
  const result = await query<ShippingZoneRow>(
    `
      SELECT id, zone_name, base_price, zip_codes, free_shipping_threshold, created_at, updated_at
      FROM shipping_zones
      ORDER BY zone_name ASC
    `
  );

  return result.rows.map(mapShippingZoneRow);
}

export async function getShippingZoneById(zoneId: string): Promise<ShippingZone | null> {
  const result = await query<ShippingZoneRow>(
    `
      SELECT id, zone_name, base_price, zip_codes, free_shipping_threshold, created_at, updated_at
      FROM shipping_zones
      WHERE id = $1
    `,
    [zoneId]
  );

  const row = result.rows[0];
  return row ? mapShippingZoneRow(row) : null;
}

async function findConflictingZoneZip(zipCodes: string[], excludeZoneId?: string) {
  if (zipCodes.length === 0) {
    return null;
  }

  const result = await query<{ zone_name: string; zip_code: string }>(
    `
      SELECT sz.zone_name, z.zip_code
      FROM shipping_zones sz
      CROSS JOIN LATERAL unnest(sz.zip_codes) AS z(zip_code)
      WHERE z.zip_code = ANY($1::text[])
        AND ($2::uuid IS NULL OR sz.id <> $2::uuid)
      LIMIT 1
    `,
    [zipCodes, excludeZoneId ?? null]
  );

  return result.rows[0] ?? null;
}

function computeShippingAmount(params: {
  basePrice: number;
  freeShippingThreshold: number | null;
  merchandiseSubtotal: number;
}) {
  if (
    params.freeShippingThreshold !== null &&
    params.merchandiseSubtotal >= params.freeShippingThreshold
  ) {
    return 0;
  }

  return roundCurrency(params.basePrice);
}

export async function resolveShippingQuote(
  postalCodeInput: string,
  merchandiseSubtotal: number
): Promise<ShippingQuote | { error: string }> {
  const postalCode = normalizeShippingZip(postalCodeInput);

  if (!postalCode) {
    return { error: "Enter a valid 5-digit US ZIP code" };
  }

  const [zoneResult, settings] = await Promise.all([
    query<ShippingZoneRow>(
      `
        SELECT id, zone_name, base_price, zip_codes, free_shipping_threshold, created_at, updated_at
        FROM shipping_zones
        WHERE $1 = ANY(zip_codes)
        ORDER BY created_at ASC
        LIMIT 1
      `,
      [postalCode]
    ),
    getShippingSettings(),
  ]);

  const normalizedSubtotal = roundCurrency(Math.max(0, merchandiseSubtotal));

  if (zoneResult.rows[0]) {
    const zone = mapShippingZoneRow(zoneResult.rows[0]);
    const shippingAmount = computeShippingAmount({
      basePrice: zone.basePrice,
      freeShippingThreshold: zone.freeShippingThreshold,
      merchandiseSubtotal: normalizedSubtotal,
    });

    return {
      zoneId: zone.id,
      zoneName: zone.zoneName,
      basePrice: zone.basePrice,
      shippingAmount,
      isFreeShipping: shippingAmount === 0 && zone.basePrice > 0,
      isOutOfZone: false,
      notice: null,
      postalCode,
    };
  }

  const defaultRate = roundCurrency(settings.defaultOutOfZoneRate);

  return {
    zoneId: null,
    zoneName: null,
    basePrice: defaultRate,
    shippingAmount: defaultRate,
    isFreeShipping: false,
    isOutOfZone: true,
    notice: OUT_OF_ZONE_NOTICE,
    postalCode,
  };
}

export async function createShippingZone(input: {
  zoneName: string;
  basePrice: number;
  zipCodesInput: string;
  freeShippingThreshold?: number | null;
}) {
  const zoneName = sanitizePlainText(input.zoneName, 200, true);
  const zipCodes = parseZipCodesInput(input.zipCodesInput);
  const basePrice = roundCurrency(input.basePrice);

  if (!zoneName) {
    throw new Error("Zone name is required");
  }

  if (zipCodes.length === 0) {
    throw new Error("Add at least one valid 5-digit ZIP code");
  }

  if (!Number.isFinite(basePrice) || basePrice < 0) {
    throw new Error("Base price must be zero or greater");
  }

  const freeShippingThreshold =
    input.freeShippingThreshold === undefined || input.freeShippingThreshold === null
      ? null
      : roundCurrency(input.freeShippingThreshold);

  if (freeShippingThreshold !== null && freeShippingThreshold < 0) {
    throw new Error("Free shipping threshold must be zero or greater");
  }

  const conflict = await findConflictingZoneZip(zipCodes);

  if (conflict) {
    throw new Error(
      `ZIP ${conflict.zip_code} is already assigned to zone "${conflict.zone_name}"`
    );
  }

  const result = await query<ShippingZoneRow>(
    `
      INSERT INTO shipping_zones (zone_name, base_price, zip_codes, free_shipping_threshold)
      VALUES ($1, $2, $3, $4)
      RETURNING id, zone_name, base_price, zip_codes, free_shipping_threshold, created_at, updated_at
    `,
    [zoneName, basePrice, zipCodes, freeShippingThreshold]
  );

  return mapShippingZoneRow(result.rows[0]!);
}

export async function updateShippingZone(
  zoneId: string,
  input: {
    zoneName?: string;
    basePrice?: number;
    zipCodesInput?: string;
    freeShippingThreshold?: number | null;
  }
) {
  const existing = await getShippingZoneById(zoneId);

  if (!existing) {
    throw new Error("Shipping zone not found");
  }

  const zoneName =
    input.zoneName !== undefined ? sanitizePlainText(input.zoneName, 200, true) : existing.zoneName;
  const zipCodes =
    input.zipCodesInput !== undefined ? parseZipCodesInput(input.zipCodesInput) : existing.zipCodes;
  const basePrice =
    input.basePrice !== undefined ? roundCurrency(input.basePrice) : existing.basePrice;
  const freeShippingThreshold =
    input.freeShippingThreshold !== undefined
      ? input.freeShippingThreshold === null
        ? null
        : roundCurrency(input.freeShippingThreshold)
      : existing.freeShippingThreshold;

  if (!zoneName) {
    throw new Error("Zone name is required");
  }

  if (zipCodes.length === 0) {
    throw new Error("Add at least one valid 5-digit ZIP code");
  }

  if (!Number.isFinite(basePrice) || basePrice < 0) {
    throw new Error("Base price must be zero or greater");
  }

  if (freeShippingThreshold !== null && freeShippingThreshold < 0) {
    throw new Error("Free shipping threshold must be zero or greater");
  }

  const conflict = await findConflictingZoneZip(zipCodes, zoneId);

  if (conflict) {
    throw new Error(
      `ZIP ${conflict.zip_code} is already assigned to zone "${conflict.zone_name}"`
    );
  }

  const result = await query<ShippingZoneRow>(
    `
      UPDATE shipping_zones
      SET
        zone_name = $2,
        base_price = $3,
        zip_codes = $4,
        free_shipping_threshold = $5,
        updated_at = NOW()
      WHERE id = $1
      RETURNING id, zone_name, base_price, zip_codes, free_shipping_threshold, created_at, updated_at
    `,
    [zoneId, zoneName, basePrice, zipCodes, freeShippingThreshold]
  );

  return mapShippingZoneRow(result.rows[0]!);
}

export async function deleteShippingZone(zoneId: string) {
  const existing = await getShippingZoneById(zoneId);

  if (!existing) {
    throw new Error("Shipping zone not found");
  }

  await query(`DELETE FROM shipping_zones WHERE id = $1`, [zoneId]);
  return existing;
}

export async function updateShippingSettings(input: { defaultOutOfZoneRate: number }) {
  const defaultOutOfZoneRate = roundCurrency(input.defaultOutOfZoneRate);

  if (!Number.isFinite(defaultOutOfZoneRate) || defaultOutOfZoneRate < 0) {
    throw new Error("Default out-of-zone rate must be zero or greater");
  }

  await query(
    `
      UPDATE shipping_settings
      SET default_out_of_zone_rate = $1, updated_at = NOW()
      WHERE id = 1
    `,
    [defaultOutOfZoneRate]
  );

  return { defaultOutOfZoneRate };
}
