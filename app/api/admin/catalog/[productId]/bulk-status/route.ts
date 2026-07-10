import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/api-auth";
import {
  applyCatalogBulkStatus,
  type CatalogBulkStatusAction,
} from "@/lib/catalog-bulk-status";

type RouteContext = {
  params: Promise<{ productId: string }>;
};

const STOCK_SUCCESS_MESSAGE = "Stock status updated successfully.";

function parseAction(value: unknown): CatalogBulkStatusAction | null {
  if (value === "out_of_stock" || value === "in_stock" || value === "toggle_unlist") {
    return value;
  }

  return null;
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("can_toggle_products");

  if (auth.response) {
    return auth.response;
  }

  const { productId: productIdParam } = await context.params;
  const productId = Number.parseInt(productIdParam, 10);

  if (!Number.isFinite(productId) || productId <= 0) {
    return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
  }

  let body: { action?: unknown };

  try {
    body = (await request.json()) as { action?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const action = parseAction(body.action);

  if (!action) {
    return NextResponse.json(
      { error: 'action must be "out_of_stock", "in_stock", or "toggle_unlist"' },
      { status: 400 }
    );
  }

  try {
    const result = await applyCatalogBulkStatus({
      productId,
      action,
      adminUserId: auth.user!.id,
    });

    if (result.action === "toggle_unlist") {
      return NextResponse.json({
        ok: true,
        action,
        productId: result.productId,
        productName: result.productName,
        isListed: result.isListed,
        message: result.isListed
          ? `${result.productName} is now listed in the catalog.`
          : `${result.productName} was unlisted from the catalog.`,
      });
    }

    return NextResponse.json({
      ok: true,
      action: result.action,
      productId: result.productId,
      productName: result.productName,
      updatedVariantCount: result.updatedVariantCount,
      message: STOCK_SUCCESS_MESSAGE,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update product status",
      },
      { status: 400 }
    );
  }
}
