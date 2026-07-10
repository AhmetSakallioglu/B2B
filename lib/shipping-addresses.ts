import { query } from "@/lib/db";
import { sanitizePlainText } from "@/lib/input-sanitization";
import { normalizeShippingZip } from "@/lib/shipping-zip";
import type {
  ShippingAddress,
  ShippingAddressInput,
  ShippingAddressRow,
} from "@/types/shipping-address";
import type { UserProfile } from "@/types/account";

function mapShippingAddressRow(row: ShippingAddressRow): ShippingAddress {
  return {
    id: row.id,
    userId: row.user_id,
    addressTitle: row.address_title,
    streetAddress: row.street_address,
    city: row.city,
    state: row.state,
    zipCode: row.zip_code,
    contactPerson: row.contact_person,
    contactPhone: row.contact_phone,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function sanitizeAddressInput(input: ShippingAddressInput): ShippingAddressInput {
  const zipCode = normalizeShippingZip(input.zipCode);

  if (!zipCode) {
    throw new Error("Enter a valid 5-digit ZIP code");
  }

  const addressTitle = sanitizePlainText(input.addressTitle, 150, true);
  const streetAddress = sanitizePlainText(input.streetAddress, 255, true);
  const city = sanitizePlainText(input.city, 100, true);
  const state = sanitizePlainText(input.state ?? "TX", 50, true) || "TX";

  if (!addressTitle || !streetAddress || !city) {
    throw new Error("Address title, street, and city are required");
  }

  return {
    addressTitle,
    streetAddress,
    city,
    state,
    zipCode,
    contactPerson: input.contactPerson
      ? sanitizePlainText(input.contactPerson, 150, false) || null
      : null,
    contactPhone: input.contactPhone
      ? sanitizePlainText(input.contactPhone, 50, false) || null
      : null,
  };
}

export function resolveZipFromBilling(profile: UserProfile) {
  const zip = normalizeShippingZip(profile.postalCode);

  if (!zip) {
    throw new Error("Complete your company ZIP code in My Account before checkout");
  }

  return zip;
}

export async function listShippingAddresses(userId: number) {
  const result = await query<ShippingAddressRow>(
    `
      SELECT
        id, user_id, address_title, street_address, city, state, zip_code,
        contact_person, contact_phone, created_at, updated_at
      FROM shipping_addresses
      WHERE user_id = $1
      ORDER BY updated_at DESC, address_title ASC
    `,
    [userId]
  );

  return result.rows.map(mapShippingAddressRow);
}

export async function getShippingAddressForUser(userId: number, addressId: string) {
  const result = await query<ShippingAddressRow>(
    `
      SELECT
        id, user_id, address_title, street_address, city, state, zip_code,
        contact_person, contact_phone, created_at, updated_at
      FROM shipping_addresses
      WHERE user_id = $1 AND id = $2
    `,
    [userId, addressId]
  );

  const row = result.rows[0];
  return row ? mapShippingAddressRow(row) : null;
}

export async function createShippingAddress(userId: number, input: ShippingAddressInput) {
  const address = sanitizeAddressInput(input);

  const result = await query<ShippingAddressRow>(
    `
      INSERT INTO shipping_addresses (
        user_id,
        address_title,
        street_address,
        city,
        state,
        zip_code,
        contact_person,
        contact_phone
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING
        id, user_id, address_title, street_address, city, state, zip_code,
        contact_person, contact_phone, created_at, updated_at
    `,
    [
      userId,
      address.addressTitle,
      address.streetAddress,
      address.city,
      address.state ?? "TX",
      address.zipCode,
      address.contactPerson ?? null,
      address.contactPhone ?? null,
    ]
  );

  return mapShippingAddressRow(result.rows[0]!);
}

export async function updateShippingAddress(
  userId: number,
  addressId: string,
  input: ShippingAddressInput
) {
  const address = sanitizeAddressInput(input);
  const existing = await getShippingAddressForUser(userId, addressId);

  if (!existing) {
    throw new Error("Shipping address not found");
  }

  const result = await query<ShippingAddressRow>(
    `
      UPDATE shipping_addresses
      SET
        address_title = $3,
        street_address = $4,
        city = $5,
        state = $6,
        zip_code = $7,
        contact_person = $8,
        contact_phone = $9,
        updated_at = NOW()
      WHERE user_id = $1 AND id = $2
      RETURNING
        id, user_id, address_title, street_address, city, state, zip_code,
        contact_person, contact_phone, created_at, updated_at
    `,
    [
      userId,
      addressId,
      address.addressTitle,
      address.streetAddress,
      address.city,
      address.state ?? "TX",
      address.zipCode,
      address.contactPerson ?? null,
      address.contactPhone ?? null,
    ]
  );

  const row = result.rows[0];

  if (!row) {
    throw new Error("Shipping address not found");
  }

  return mapShippingAddressRow(row);
}

export async function deleteShippingAddress(userId: number, addressId: string) {
  const result = await query<{ id: string }>(
    `
      DELETE FROM shipping_addresses
      WHERE user_id = $1 AND id = $2
      RETURNING id
    `,
    [userId, addressId]
  );

  if (result.rows.length === 0) {
    throw new Error("Shipping address not found");
  }
}

export async function resolveCheckoutShippingZip(params: {
  userId: number;
  profile: UserProfile;
  selection: import("@/types/shipping-address").CheckoutShippingSelection;
}) {
  if (params.selection.type === "billing") {
    return {
      zipCode: resolveZipFromBilling(params.profile),
      shippingAddressId: null as string | null,
    };
  }

  if (params.selection.type === "saved") {
    const saved = await getShippingAddressForUser(params.userId, params.selection.addressId);

    if (!saved) {
      throw new Error("Selected shipping address was not found");
    }

    const zipCode = normalizeShippingZip(saved.zipCode);

    if (!zipCode) {
      throw new Error("Selected address has an invalid ZIP code");
    }

    return { zipCode, shippingAddressId: saved.id };
  }

  const sanitized = sanitizeAddressInput(params.selection.address);
  let shippingAddressId: string | null = null;

  if (params.selection.saveForFuture) {
    const created = await createShippingAddress(params.userId, sanitized);
    shippingAddressId = created.id;
  }

  return { zipCode: sanitized.zipCode, shippingAddressId };
}
