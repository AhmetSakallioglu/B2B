import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/api-auth";
import type { parseUpdateProductBody } from "@/lib/product-admin";
import type { parseUpdateDoorFinishBody } from "@/lib/door-finish";

type UpdateProductBody = NonNullable<ReturnType<typeof parseUpdateProductBody>>;
type UpdateDoorFinishBody = NonNullable<ReturnType<typeof parseUpdateDoorFinishBody>>;

type VariantSnapshot = {
  width_in: string | number;
  height_in: string | number;
  depth_in: string | number;
  stock_status: string;
  price: string | number;
  sku: string;
};

type ProductSnapshot = {
  name: string;
  description: string | null;
  sub_category_id: number;
  image_url: string | null;
};

function numericEquals(left: string | number, right: number) {
  return Number.parseFloat(String(left)) === right;
}

export function isStockOnlyVariantUpdate(
  variant: VariantSnapshot,
  product: ProductSnapshot,
  body: UpdateProductBody,
  subCategoryId: number
) {
  const stockChanged = variant.stock_status !== body.stockStatus;

  if (!stockChanged) {
    return false;
  }

  return (
    numericEquals(variant.width_in, body.widthIn) &&
    numericEquals(variant.height_in, body.heightIn) &&
    numericEquals(variant.depth_in, body.depthIn) &&
    numericEquals(variant.price, body.price) &&
    (body.variantSku === undefined ||
      body.variantSku.trim() === "" ||
      body.variantSku.trim() === variant.sku) &&
    product.name === body.productName &&
    (product.description ?? "") === body.description &&
    product.sub_category_id === subCategoryId &&
    body.imageUrl === undefined
  );
}

export function isFinishActivationOnlyUpdate(
  before: Record<string, unknown>,
  body: UpdateDoorFinishBody
) {
  if (body.finishImages !== undefined) {
    return false;
  }

  const previousIsActive = before.is_active === true;

  if (previousIsActive === body.isActive) {
    return false;
  }

  return (
    String(before.name) === body.name &&
    String(before.slug) === body.slug &&
    String(before.description ?? "") === (body.description ?? "") &&
    Number(before.sort_order) === body.sortOrder &&
    (body.sampleImageUrl === undefined ||
      String(before.sample_image_url ?? "") === (body.sampleImageUrl ?? ""))
  );
}

type AdminAuthResult =
  | {
      user: null;
      permissions: null;
      response: NextResponse;
    }
  | {
      user: NonNullable<Awaited<ReturnType<typeof requireAdminPermission>>["user"]>;
      permissions: NonNullable<
        Awaited<ReturnType<typeof requireAdminPermission>>["permissions"]
      >;
      response: null;
    };

export async function requireProductUpdatePermission(
  variant: VariantSnapshot,
  product: ProductSnapshot,
  body: UpdateProductBody,
  subCategoryId: number
): Promise<AdminAuthResult> {
  if (isStockOnlyVariantUpdate(variant, product, body, subCategoryId)) {
    return requireAdminPermission("can_toggle_products") as Promise<AdminAuthResult>;
  }

  return requireAdminPermission("can_add_products") as Promise<AdminAuthResult>;
}

export async function requireFinishUpdatePermission(
  before: Record<string, unknown>,
  body: UpdateDoorFinishBody
): Promise<AdminAuthResult> {
  if (isFinishActivationOnlyUpdate(before, body)) {
    return requireAdminPermission("can_toggle_finishes") as Promise<AdminAuthResult>;
  }

  return requireAdminPermission("can_add_finishes") as Promise<AdminAuthResult>;
}
