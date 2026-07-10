import type { PoolClient } from "pg";
import { query } from "@/lib/db";
import { buildDeletedSku } from "@/lib/soft-delete-sku";
import type { AuditAction, AuditableTable, AuditLogEntry, AuditLogRow } from "@/types/audit-log";
import { formatAuditLogSummary } from "@/lib/audit-log-format";

type QueryExecutor = Pick<PoolClient, "query">;

const AUDITABLE_TABLES = new Set<AuditableTable>([
  "products",
  "product_variants",
  "door_finishes",
  "users",
  "customer_tiers",
  "quotes",
  "announcement_popups",
  "orders",
  "email_templates",
  "dealer_groups",
  "admin_permissions",
  "shipping_zones",
  "categories",
  "sub_categories",
]);

const RESTORABLE_TABLES = new Set<AuditableTable>([
  "products",
  "product_variants",
  "door_finishes",
]);

export function isAuditableTable(value: string): value is AuditableTable {
  return AUDITABLE_TABLES.has(value as AuditableTable);
}

export function isRestorableTable(value: string): value is AuditableTable {
  return RESTORABLE_TABLES.has(value as AuditableTable);
}

export async function writeAuditLog(
  params: {
    userId: number | null;
    action: AuditAction;
    tableName: AuditableTable;
    recordId: number;
    oldValues?: Record<string, unknown> | null;
    newValues?: Record<string, unknown> | null;
  },
  client?: QueryExecutor
) {
  const runQuery = client?.query.bind(client) ?? query;

  await runQuery(
    `
      INSERT INTO audit_logs (
        user_id,
        action,
        table_name,
        record_id,
        old_values,
        new_values
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
    `,
    [
      params.userId,
      params.action,
      params.tableName,
      params.recordId,
      params.oldValues ? JSON.stringify(params.oldValues) : null,
      params.newValues ? JSON.stringify(params.newValues) : null,
    ]
  );
}

export async function fetchProductSnapshot(productId: number, client?: QueryExecutor) {
  const runQuery = client?.query.bind(client) ?? query;
  const result = await runQuery<Record<string, unknown>>(
    `
      SELECT
        id,
        sub_category_id,
        sku,
        name,
        description,
        image_url,
        images,
        created_at,
        updated_at,
        created_by,
        updated_by,
        deleted_at
      FROM products
      WHERE id = $1
    `,
    [productId]
  );

  return result.rows[0] ?? null;
}

export async function fetchVariantSnapshot(variantId: number, client?: QueryExecutor) {
  const runQuery = client?.query.bind(client) ?? query;
  const result = await runQuery<Record<string, unknown>>(
    `
      SELECT
        id,
        product_id,
        finish_id,
        width_in,
        height_in,
        depth_in,
        stock_status,
        price,
        sku,
        variant_images,
        created_at,
        updated_at,
        created_by,
        updated_by,
        deleted_at
      FROM product_variants
      WHERE id = $1
    `,
    [variantId]
  );

  return result.rows[0] ?? null;
}

export async function fetchFinishSnapshot(finishId: number, client?: QueryExecutor) {
  const runQuery = client?.query.bind(client) ?? query;
  const result = await runQuery<Record<string, unknown>>(
    `
      SELECT
        id,
        name,
        slug,
        description,
        sample_image_url,
        finish_images,
        sort_order,
        is_active,
        created_at,
        updated_at,
        created_by,
        updated_by,
        deleted_at
      FROM door_finishes
      WHERE id = $1
    `,
    [finishId]
  );

  return result.rows[0] ?? null;
}

function serializeSnapshot(row: Record<string, unknown> | null) {
  if (!row) {
    return null;
  }

  return JSON.parse(JSON.stringify(row)) as Record<string, unknown>;
}

export async function softDeleteProduct(
  productId: number,
  userId: number | null,
  client: QueryExecutor
) {
  const before = serializeSnapshot(await fetchProductSnapshot(productId, client));

  if (!before || before.deleted_at) {
    return false;
  }

  const renamedSku = buildDeletedSku(String(before.sku));

  await client.query(
    `
      UPDATE products
      SET
        sku = $3,
        deleted_at = NOW(),
        updated_at = NOW(),
        updated_by = $2
      WHERE id = $1
        AND deleted_at IS NULL
    `,
    [productId, userId, renamedSku]
  );

  const after = serializeSnapshot(await fetchProductSnapshot(productId, client));

  await writeAuditLog(
    {
      userId,
      action: "SOFT_DELETE",
      tableName: "products",
      recordId: productId,
      oldValues: before,
      newValues: after,
    },
    client
  );

  return true;
}

export async function softDeleteVariant(
  variantId: number,
  userId: number | null,
  client: QueryExecutor
) {
  const before = serializeSnapshot(await fetchVariantSnapshot(variantId, client));

  if (!before || before.deleted_at) {
    return false;
  }

  const renamedSku = buildDeletedSku(String(before.sku));

  await client.query(
    `
      UPDATE product_variants
      SET
        sku = $3,
        deleted_at = NOW(),
        updated_at = NOW(),
        updated_by = $2
      WHERE id = $1
        AND deleted_at IS NULL
    `,
    [variantId, userId, renamedSku]
  );

  const after = serializeSnapshot(await fetchVariantSnapshot(variantId, client));

  await writeAuditLog(
    {
      userId,
      action: "SOFT_DELETE",
      tableName: "product_variants",
      recordId: variantId,
      oldValues: before,
      newValues: after,
    },
    client
  );

  return true;
}

export async function softDeleteFinish(
  finishId: number,
  userId: number | null,
  client: QueryExecutor
) {
  const before = serializeSnapshot(await fetchFinishSnapshot(finishId, client));

  if (!before || before.deleted_at) {
    return false;
  }

  await client.query(
    `
      UPDATE door_finishes
      SET
        deleted_at = NOW(),
        updated_at = NOW(),
        updated_by = $2
      WHERE id = $1
        AND deleted_at IS NULL
    `,
    [finishId, userId]
  );

  const after = serializeSnapshot(await fetchFinishSnapshot(finishId, client));

  await writeAuditLog(
    {
      userId,
      action: "SOFT_DELETE",
      tableName: "door_finishes",
      recordId: finishId,
      oldValues: before,
      newValues: after,
    },
    client
  );

  return true;
}

async function restoreSoftDeletedRow(
  tableName: AuditableTable,
  recordId: number,
  userId: number | null,
  client: QueryExecutor,
  oldValues?: Record<string, unknown> | null
) {
  if (tableName === "products") {
    const originalSku =
      oldValues?.sku !== undefined && oldValues.sku !== null
        ? String(oldValues.sku)
        : null;

    await client.query(
      `
        UPDATE products
        SET
          deleted_at = NULL,
          sku = COALESCE($3, sku),
          updated_at = NOW(),
          updated_by = $2
        WHERE id = $1
      `,
      [recordId, userId, originalSku]
    );
    return fetchProductSnapshot(recordId, client);
  }

  if (tableName === "product_variants") {
    const originalSku =
      oldValues?.sku !== undefined && oldValues.sku !== null
        ? String(oldValues.sku)
        : null;

    await client.query(
      `
        UPDATE product_variants
        SET
          deleted_at = NULL,
          sku = COALESCE($3, sku),
          updated_at = NOW(),
          updated_by = $2
        WHERE id = $1
      `,
      [recordId, userId, originalSku]
    );
    return fetchVariantSnapshot(recordId, client);
  }

  await client.query(
    `
      UPDATE door_finishes
      SET deleted_at = NULL, updated_at = NOW(), updated_by = $2
      WHERE id = $1
    `,
    [recordId, userId]
  );
  return fetchFinishSnapshot(recordId, client);
}

async function applySnapshotValues(
  tableName: AuditableTable,
  recordId: number,
  values: Record<string, unknown>,
  userId: number | null,
  client: QueryExecutor
) {
  if (tableName === "products") {
    await client.query(
      `
        UPDATE products
        SET
          sub_category_id = $2,
          sku = $3,
          name = $4,
          description = $5,
          image_url = $6,
          updated_at = NOW(),
          updated_by = $7,
          deleted_at = NULL
        WHERE id = $1
      `,
      [
        recordId,
        values.sub_category_id,
        values.sku,
        values.name,
        values.description ?? null,
        values.image_url ?? null,
        userId,
      ]
    );
    return fetchProductSnapshot(recordId, client);
  }

  if (tableName === "product_variants") {
    await client.query(
      `
        UPDATE product_variants
        SET
          product_id = $2,
          finish_id = $3,
          width_in = $4,
          height_in = $5,
          depth_in = $6,
          stock_status = $7,
          price = $8,
          sku = $9,
          updated_at = NOW(),
          updated_by = $10,
          deleted_at = NULL
        WHERE id = $1
      `,
      [
        recordId,
        values.product_id,
        values.finish_id,
        values.width_in,
        values.height_in,
        values.depth_in,
        values.stock_status,
        values.price,
        values.sku,
        userId,
      ]
    );
    return fetchVariantSnapshot(recordId, client);
  }

  await client.query(
    `
      UPDATE door_finishes
      SET
        name = $2,
        slug = $3,
        description = $4,
        sample_image_url = $5,
        sort_order = $6,
        is_active = $7,
        updated_at = NOW(),
        updated_by = $8,
        deleted_at = NULL
      WHERE id = $1
    `,
    [
      recordId,
      values.name,
      values.slug,
      values.description ?? null,
      values.sample_image_url ?? null,
      values.sort_order,
      values.is_active,
      userId,
    ]
  );
  return fetchFinishSnapshot(recordId, client);
}

export async function restoreAuditLogEntry(logId: number, userId: number | null) {
  const client = await (await import("@/lib/db")).pool.connect();

  try {
    await client.query("BEGIN");

    const logResult = await client.query<AuditLogRow>(
      `
        SELECT
          id,
          user_id,
          action,
          table_name,
          record_id,
          old_values,
          new_values,
          created_at,
          restored_at,
          restored_by
        FROM audit_logs
        WHERE id = $1
        FOR UPDATE
      `,
      [logId]
    );

    const log = logResult.rows[0];

    if (!log) {
      await client.query("ROLLBACK");
      return { ok: false as const, error: "Audit log entry not found" };
    }

    if (log.restored_at) {
      await client.query("ROLLBACK");
      return { ok: false as const, error: "This action has already been restored" };
    }

    if (!isRestorableTable(log.table_name)) {
      await client.query("ROLLBACK");
      return { ok: false as const, error: "Unsupported table for restore" };
    }

    if (!isAuditableTable(log.table_name)) {
      await client.query("ROLLBACK");
      return { ok: false as const, error: "Unsupported table for restore" };
    }

    if (!log.old_values && log.action !== "CREATE") {
      await client.query("ROLLBACK");
      return { ok: false as const, error: "No previous values available to restore" };
    }

    let restoredSnapshot: Record<string, unknown> | null = null;

    if (log.action === "SOFT_DELETE") {
      restoredSnapshot = serializeSnapshot(
        await restoreSoftDeletedRow(
          log.table_name,
          log.record_id,
          userId,
          client,
          log.old_values as Record<string, unknown> | null
        )
      );
    } else if (log.action === "UPDATE") {
      restoredSnapshot = serializeSnapshot(
        await applySnapshotValues(
          log.table_name,
          log.record_id,
          log.old_values as Record<string, unknown>,
          userId,
          client
        )
      );
    } else if (log.action === "CREATE") {
      if (log.table_name === "product_variants") {
        await softDeleteVariant(log.record_id, userId, client);
        restoredSnapshot = serializeSnapshot(
          await fetchVariantSnapshot(log.record_id, client)
        );
      } else if (log.table_name === "products") {
        await softDeleteProduct(log.record_id, userId, client);
        restoredSnapshot = serializeSnapshot(
          await fetchProductSnapshot(log.record_id, client)
        );
      } else {
        await softDeleteFinish(log.record_id, userId, client);
        restoredSnapshot = serializeSnapshot(
          await fetchFinishSnapshot(log.record_id, client)
        );
      }
    } else {
      await client.query("ROLLBACK");
      return { ok: false as const, error: "This audit entry cannot be restored" };
    }

    await writeAuditLog(
      {
        userId,
        action: "RESTORE",
        tableName: log.table_name,
        recordId: log.record_id,
        oldValues: log.new_values as Record<string, unknown> | null,
        newValues: restoredSnapshot,
      },
      client
    );

    await client.query(
      `
        UPDATE audit_logs
        SET restored_at = NOW(), restored_by = $2
        WHERE id = $1
      `,
      [logId, userId]
    );

    await client.query("COMMIT");

    return { ok: true as const };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function mapAuditLogRow(row: AuditLogRow & { user_email?: string | null }): AuditLogEntry {
  return {
    id: row.id,
    userId: row.user_id,
    userEmail: row.user_email ?? null,
    action: row.action,
    tableName: row.table_name,
    recordId: row.record_id,
    oldValues: row.old_values,
    newValues: row.new_values,
    createdAt: row.created_at,
    restoredAt: row.restored_at,
    restoredBy: row.restored_by,
    canRestore:
      row.restored_at === null &&
      isRestorableTable(row.table_name) &&
      (row.action === "SOFT_DELETE" || row.action === "UPDATE" || row.action === "CREATE"),
    summary: formatAuditLogSummary(row),
  };
}

export async function listAuditLogs(limit = 100) {
  const result = await query<AuditLogRow & { user_email: string | null }>(
    `
      SELECT
        al.id,
        al.user_id,
        u.email AS user_email,
        al.action,
        al.table_name,
        al.record_id,
        al.old_values,
        al.new_values,
        al.created_at,
        al.restored_at,
        al.restored_by
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      ORDER BY al.created_at DESC
      LIMIT $1
    `,
    [limit]
  );

  return result.rows.map(mapAuditLogRow);
}
