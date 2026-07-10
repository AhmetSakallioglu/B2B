import { mergeGuestCartItems, loadUserCartItems } from "@/lib/cart";
import { getUnavailableVariantIds } from "@/lib/cart-validation";
import { getUserDiscountPercent } from "@/lib/customer-tier";
import { query } from "@/lib/db";
import {
  parseRoomTemplateStoredItems,
  summarizeRoomTemplateItems,
} from "@/lib/room-template-storage";
import { ROOM_TEMPLATE_MULTIPLIER_MAX } from "@/lib/room-template-validation";
import type {
  RoomTemplateDetail,
  RoomTemplateStoredItem,
  RoomTemplateSummary,
} from "@/types/room-templates";

type RoomTemplateRow = {
  id: string;
  user_id: number;
  template_name: string;
  items: unknown;
  created_at: string;
  updated_at: string;
};

const MAX_CART_LINE_QUANTITY = 9999;

function mapRoomTemplateSummary(row: RoomTemplateRow): RoomTemplateSummary {
  const items = parseRoomTemplateStoredItems(row.items);
  const summary = summarizeRoomTemplateItems(items);

  return {
    id: row.id,
    templateName: row.template_name,
    lineCount: summary.lineCount,
    totalQuantity: summary.totalQuantity,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRoomTemplateDetail(row: RoomTemplateRow): RoomTemplateDetail {
  const items = parseRoomTemplateStoredItems(row.items);
  const summary = summarizeRoomTemplateItems(items);

  return {
    id: row.id,
    templateName: row.template_name,
    lineCount: summary.lineCount,
    totalQuantity: summary.totalQuantity,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items,
    userId: row.user_id,
  };
}

async function enrichTemplateItems(
  items: Array<{ variantId: string; quantity: number }>
): Promise<RoomTemplateStoredItem[]> {
  if (items.length === 0) {
    return [];
  }

  const variantIds = items.map((item) => Number.parseInt(item.variantId, 10));
  const skuResult = await query<{ id: number; sku: string }>(
    `
      SELECT pv.id, p.sku
      FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      WHERE pv.id = ANY($1::int[])
        AND pv.deleted_at IS NULL
        AND p.deleted_at IS NULL
    `,
    [variantIds]
  );

  const skuByVariantId = new Map(skuResult.rows.map((row) => [row.id, row.sku]));

  return items.map((item) => {
    const variantId = Number.parseInt(item.variantId, 10);

    return {
      variant_id: variantId,
      cabinet_code: skuByVariantId.get(variantId) ?? `variant-${variantId}`,
      quantity: item.quantity,
    };
  });
}

export async function createRoomTemplate(params: {
  userId: number;
  templateName: string;
  items: Array<{ variantId: string; quantity: number }>;
}) {
  const storedItems = await enrichTemplateItems(params.items);

  if (storedItems.length === 0) {
    throw new Error("Template must include at least one valid cabinet line");
  }

  const result = await query<RoomTemplateRow>(
    `
      INSERT INTO room_templates (user_id, template_name, items)
      VALUES ($1, $2, $3::jsonb)
      RETURNING id, user_id, template_name, items, created_at, updated_at
    `,
    [params.userId, params.templateName, JSON.stringify(storedItems)]
  );

  return mapRoomTemplateDetail(result.rows[0]);
}

export async function listRoomTemplatesForUser(userId: number) {
  const result = await query<RoomTemplateRow>(
    `
      SELECT id, user_id, template_name, items, created_at, updated_at
      FROM room_templates
      WHERE user_id = $1
      ORDER BY updated_at DESC, created_at DESC
    `,
    [userId]
  );

  return result.rows.map(mapRoomTemplateSummary);
}

export async function getRoomTemplateForUser(templateId: string, userId: number) {
  const result = await query<RoomTemplateRow>(
    `
      SELECT id, user_id, template_name, items, created_at, updated_at
      FROM room_templates
      WHERE id = $1 AND user_id = $2
    `,
    [templateId, userId]
  );

  const row = result.rows[0];
  return row ? mapRoomTemplateDetail(row) : null;
}

export async function deleteRoomTemplateForUser(templateId: string, userId: number) {
  const result = await query<{ id: string }>(
    `
      DELETE FROM room_templates
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `,
    [templateId, userId]
  );

  return result.rows.length > 0;
}

function clampQuantity(quantity: number) {
  return Math.min(Math.max(quantity, 1), MAX_CART_LINE_QUANTITY);
}

export async function addRoomTemplateToCart(params: {
  userId: number;
  userRole: "customer" | "admin";
  templateId: string;
  multiplier: number;
}) {
  const template = await getRoomTemplateForUser(params.templateId, params.userId);

  if (!template) {
    return { error: "Template not found", status: 404 as const };
  }

  if (template.items.length === 0) {
    return { error: "Template has no items", status: 400 as const };
  }

  if (params.multiplier < 1 || params.multiplier > ROOM_TEMPLATE_MULTIPLIER_MAX) {
    return { error: "Invalid multiplier", status: 400 as const };
  }

  const variantIds = template.items.map((item) => item.variant_id);
  const missingVariants = await getUnavailableVariantIds(variantIds);

  if (missingVariants.length > 0) {
    return {
      error:
        "Some cabinets in this template are no longer available. Update or recreate the template.",
      status: 400 as const,
    };
  }

  const cartLines = template.items.map((item) => ({
    variantId: item.variant_id,
    quantity: clampQuantity(item.quantity * params.multiplier),
  }));

  await mergeGuestCartItems(params.userId, cartLines);

  const discountPercent = await getUserDiscountPercent(params.userId, params.userRole);
  const items = await loadUserCartItems(params.userId, discountPercent);

  return {
    ok: true as const,
    items,
    templateName: template.templateName,
    multiplier: params.multiplier,
    addedLines: cartLines.length,
    redirectTo: "/cart" as const,
  };
}
