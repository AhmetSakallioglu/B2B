import { writeAuditLog } from "@/lib/audit-log";
import { query } from "@/lib/db";
import type { PoolClient } from "pg";

type QueryExecutor = Pick<PoolClient, "query">;

async function fetchAdminDisplayName(adminUserId: number, client?: QueryExecutor) {
  const runQuery = client?.query.bind(client) ?? query;

  const result = await runQuery<{ contact_name: string | null; email: string }>(
    `
      SELECT contact_name, email
      FROM users
      WHERE id = $1
    `,
    [adminUserId]
  );

  const row = result.rows[0];
  return row?.contact_name?.trim() || row?.email || "Admin";
}

export async function logProductBulkOutOfStock(
  params: {
    adminUserId: number;
    productId: number;
    productName: string;
    updatedVariantCount: number;
    beforeSnapshot: Record<string, unknown> | null;
  },
  client?: QueryExecutor
) {
  const adminName = await fetchAdminDisplayName(params.adminUserId, client);

  await writeAuditLog(
    {
      userId: params.adminUserId,
      action: "UPDATE",
      tableName: "products",
      recordId: params.productId,
      oldValues: params.beforeSnapshot,
      newValues: {
        event: "bulk_out_of_stock",
        product_name: params.productName,
        updated_variant_count: params.updatedVariantCount,
        summary: `Admin ${adminName} bulk marked all colors and variants of ${params.productName} as Out of Stock.`,
      },
    },
    client
  );
}

export async function logProductBulkInStock(
  params: {
    adminUserId: number;
    productId: number;
    productName: string;
    updatedVariantCount: number;
    beforeSnapshot: Record<string, unknown> | null;
  },
  client?: QueryExecutor
) {
  const adminName = await fetchAdminDisplayName(params.adminUserId, client);

  await writeAuditLog(
    {
      userId: params.adminUserId,
      action: "UPDATE",
      tableName: "products",
      recordId: params.productId,
      oldValues: params.beforeSnapshot,
      newValues: {
        event: "bulk_in_stock",
        product_name: params.productName,
        updated_variant_count: params.updatedVariantCount,
        summary: `Admin ${adminName} bulk marked all colors and variants of ${params.productName} as In Stock.`,
      },
    },
    client
  );
}

export async function logProductImageAdded(params: {
  adminUserId: number;
  productId: number;
  imageId: number;
  finishId: number;
  asCover: boolean;
}) {
  const adminName = await fetchAdminDisplayName(params.adminUserId);

  await writeAuditLog({
    userId: params.adminUserId,
    action: "UPDATE",
    tableName: "products",
    recordId: params.productId,
    newValues: {
      event: "product_image_added",
      image_id: params.imageId,
      finish_id: params.finishId,
      as_cover: params.asCover,
      summary: `Admin ${adminName} added a product image${params.asCover ? " as cover" : ""} (product #${params.productId}).`,
    },
  });
}

export async function logProductImageDeleted(params: {
  adminUserId: number;
  productId: number;
  imageId: number;
  finishId: number;
}) {
  const adminName = await fetchAdminDisplayName(params.adminUserId);

  await writeAuditLog({
    userId: params.adminUserId,
    action: "UPDATE",
    tableName: "products",
    recordId: params.productId,
    newValues: {
      event: "product_image_deleted",
      image_id: params.imageId,
      finish_id: params.finishId,
      summary: `Admin ${adminName} deleted product image #${params.imageId} (product #${params.productId}).`,
    },
  });
}

export async function logProductCoverImageSet(params: {
  adminUserId: number;
  productId: number;
  imageId: number;
  finishId: number;
}) {
  const adminName = await fetchAdminDisplayName(params.adminUserId);

  await writeAuditLog({
    userId: params.adminUserId,
    action: "UPDATE",
    tableName: "products",
    recordId: params.productId,
    newValues: {
      event: "product_cover_image_set",
      image_id: params.imageId,
      finish_id: params.finishId,
      summary: `Admin ${adminName} set image #${params.imageId} as cover (product #${params.productId}).`,
    },
  });
}

export async function logProductImagesReordered(params: {
  adminUserId: number;
  productId: number;
  finishId: number;
  imageCount: number;
}) {
  const adminName = await fetchAdminDisplayName(params.adminUserId);

  await writeAuditLog({
    userId: params.adminUserId,
    action: "UPDATE",
    tableName: "products",
    recordId: params.productId,
    newValues: {
      event: "product_images_reordered",
      finish_id: params.finishId,
      image_count: params.imageCount,
      summary: `Admin ${adminName} reordered ${params.imageCount} product images (product #${params.productId}).`,
    },
  });
}

export async function logProductBulkUpload(params: {
  adminUserId: number;
  fileName: string;
  createdVariants: number;
  updatedVariants: number;
  errorCount: number;
}) {
  const adminName = await fetchAdminDisplayName(params.adminUserId);
  const processed = params.createdVariants + params.updatedVariants;

  await writeAuditLog({
    userId: params.adminUserId,
    action: "CREATE",
    tableName: "products",
    recordId: params.adminUserId,
    newValues: {
      event: "bulk_upload",
      file_name: params.fileName,
      created_variants: params.createdVariants,
      updated_variants: params.updatedVariants,
      error_count: params.errorCount,
      summary: `Admin ${adminName} bulk uploaded "${params.fileName}": ${processed} variant(s) processed (${params.createdVariants} created, ${params.updatedVariants} updated)${params.errorCount > 0 ? `, ${params.errorCount} row error(s)` : ""}.`,
    },
  });
}

export async function logProductListingToggle(
  params: {
    adminUserId: number;
    productId: number;
    productName: string;
    isListed: boolean;
    beforeSnapshot: Record<string, unknown> | null;
    afterSnapshot: Record<string, unknown> | null;
  },
  client?: QueryExecutor
) {
  const adminName = await fetchAdminDisplayName(params.adminUserId, client);

  const listingAction = params.isListed
    ? "listed in the catalog"
    : "unlisted from the catalog (hidden)";

  await writeAuditLog(
    {
      userId: params.adminUserId,
      action: "UPDATE",
      tableName: "products",
      recordId: params.productId,
      oldValues: params.beforeSnapshot,
      newValues: {
        event: "toggle_unlist",
        product_name: params.productName,
        is_listed: params.isListed,
        summary: `Admin ${adminName} ${listingAction} ${params.productName}.`,
      },
    },
    client
  );
}
