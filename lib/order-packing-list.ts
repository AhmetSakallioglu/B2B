import { getAdminPermissions } from "@/lib/admin-permissions";
import { query } from "@/lib/db";
import { formatDimensionsWHD } from "@/lib/format-dimensions";
import { hasAdminPermission } from "@/types/admin-permissions";
import type { SessionUser } from "@/types/auth";
import type {
  OrderPackingListData,
  OrderPackingListShippingAddress,
} from "@/types/order-packing-list";

type ShippingAddressRow = {
  address_title: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  contact_person: string | null;
  contact_phone: string | null;
};

type PackingListItemRow = {
  product_name: string;
  product_description: string | null;
  color: string | null;
  width_in: string;
  height_in: string;
  depth_in: string;
  quantity: number;
};

function mapShippingAddress(row: ShippingAddressRow | undefined): OrderPackingListShippingAddress | null {
  if (!row?.street_address || !row.city || !row.state || !row.zip_code) {
    return null;
  }

  return {
    addressTitle: row.address_title?.trim() || "Jobsite",
    streetAddress: row.street_address,
    city: row.city,
    state: row.state,
    zipCode: row.zip_code,
    contactPerson: row.contact_person,
    contactPhone: row.contact_phone,
  };
}

function formatShippingAddressLines(address: OrderPackingListShippingAddress) {
  const lines = [
    address.addressTitle,
    address.streetAddress,
    `${address.city}, ${address.state} ${address.zipCode}`,
  ];

  if (address.contactPerson) {
    lines.push(`Contact: ${address.contactPerson}`);
  }

  if (address.contactPhone) {
    lines.push(`Phone: ${address.contactPhone}`);
  }

  return lines;
}

export async function canUserAccessOrder(user: SessionUser, orderUserId: number) {
  if (user.role === "admin") {
    const permissions = await getAdminPermissions(user.id);
    return hasAdminPermission(permissions, "can_view_orders");
  }

  return user.id === orderUserId;
}

export async function fetchOrderPackingListData(
  orderId: number,
  user: SessionUser
): Promise<OrderPackingListData | null> {
  const ownership = await query<{ user_id: number; created_at: string }>(
    `
      SELECT user_id, created_at
      FROM orders
      WHERE id = $1
    `,
    [orderId]
  );

  const ownerRow = ownership.rows[0];

  if (!ownerRow) {
    return null;
  }

  const allowed = await canUserAccessOrder(user, ownerRow.user_id);

  if (!allowed) {
    return null;
  }

  const itemsResult = await query<PackingListItemRow>(
    `
      SELECT
        p.name AS product_name,
        p.description AS product_description,
        df.name AS color,
        pv.width_in,
        pv.height_in,
        pv.depth_in,
        oi.quantity
      FROM order_items oi
      INNER JOIN product_variants pv ON pv.id = oi.variant_id
      INNER JOIN products p ON p.id = pv.product_id
      LEFT JOIN door_finishes df ON df.id = pv.finish_id
      WHERE oi.order_id = $1
      ORDER BY oi.id ASC
    `,
    [orderId]
  );

  if (itemsResult.rows.length === 0) {
    return null;
  }

  const shippingResult = await query<ShippingAddressRow>(
    `
      SELECT
        sa.address_title,
        sa.street_address,
        sa.city,
        sa.state,
        sa.zip_code,
        sa.contact_person,
        sa.contact_phone
      FROM orders o
      LEFT JOIN shipping_addresses sa ON sa.id = o.shipping_address_id
      WHERE o.id = $1
    `,
    [orderId]
  );

  const shippingAddress = mapShippingAddress(shippingResult.rows[0]);

  return {
    orderId,
    createdAt: ownerRow.created_at,
    shippingAddress,
    shippingAddressLines: shippingAddress ? formatShippingAddressLines(shippingAddress) : [],
    items: itemsResult.rows.map((row) => ({
      productName: row.product_name,
      color: row.color?.trim() || "—",
      description: row.product_description?.trim() || "—",
      sizes: formatDimensionsWHD(
        Number.parseFloat(row.width_in),
        Number.parseFloat(row.height_in),
        Number.parseFloat(row.depth_in)
      ),
      quantity: row.quantity,
    })),
  };
}
