import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/api-auth";
import { requireFinishUpdatePermission } from "@/lib/admin-mutation-auth";
import { pool } from "@/lib/db";
import {
  fetchFinishSnapshot,
  softDeleteFinish,
  writeAuditLog,
} from "@/lib/audit-log";
import {
  mapDoorFinishRow,
  parseUpdateDoorFinishBody,
  syncVariantStockForFinishStatus,
} from "@/lib/door-finish";
import type { DoorFinishRow } from "@/types/door-finish";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function serializeSnapshot(row: Record<string, unknown> | null) {
  if (!row) {
    return null;
  }

  return JSON.parse(JSON.stringify(row)) as Record<string, unknown>;
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const finishId = Number.parseInt(id, 10);

  if (Number.isNaN(finishId)) {
    return NextResponse.json({ error: "Invalid finish id" }, { status: 400 });
  }

  const body = parseUpdateDoorFinishBody(await request.json());

  if (!body) {
    return NextResponse.json({ error: "Invalid finish payload" }, { status: 400 });
  }

  const beforeSnapshot = serializeSnapshot(await fetchFinishSnapshot(finishId));

  if (!beforeSnapshot || beforeSnapshot.deleted_at) {
    return NextResponse.json({ error: "Finish not found" }, { status: 404 });
  }

  const auth = await requireFinishUpdatePermission(beforeSnapshot, body);

  if (auth.response) {
    return auth.response;
  }

  const userId = auth.user!.id;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const before = beforeSnapshot;
    const previousIsActive = before.is_active === true;

    const values: unknown[] = [finishId, body.name, body.slug, body.description || null];

    let sampleImageClause = "";
    let finishImagesClause = "";

    if (body.sampleImageUrl !== undefined) {
      values.push(body.sampleImageUrl);
      sampleImageClause = `sample_image_url = $${values.length},\n          `;
    }

    if (body.finishImages !== undefined) {
      values.push(body.finishImages);
      const finishImagesParam = `$${values.length}::text[]`;
      finishImagesClause = `finish_images = ${finishImagesParam},
          sample_image_url = CASE
            WHEN cardinality(${finishImagesParam}) > 0 THEN (${finishImagesParam})[1]
            ELSE NULL
          END,
          `;
    }

    values.push(body.sortOrder, body.isActive, userId);

    const sortOrderIndex = values.length - 2;
    const isActiveIndex = values.length - 1;
    const updatedByIndex = values.length;

    const result = await client.query<DoorFinishRow>(
      `
        UPDATE door_finishes
        SET
          name = $2,
          slug = $3,
          description = $4,
          ${sampleImageClause}${finishImagesClause}sort_order = $${sortOrderIndex},
          is_active = $${isActiveIndex},
          updated_by = $${updatedByIndex},
          updated_at = NOW()
        WHERE id = $1
          AND deleted_at IS NULL
        RETURNING
          id,
          name,
          slug,
          description,
          sample_image_url,
          finish_images,
          sort_order,
          is_active
      `,
      values
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Finish not found" }, { status: 404 });
    }

    if (previousIsActive !== body.isActive) {
      await syncVariantStockForFinishStatus(finishId, body.isActive, client);
    }

    const after = serializeSnapshot(await fetchFinishSnapshot(finishId, client));

    await writeAuditLog(
      {
        userId,
        action: "UPDATE",
        tableName: "door_finishes",
        recordId: finishId,
        oldValues: before,
        newValues: after,
      },
      client
    );

    const count = await client.query<{ variant_count: string }>(
      `
        SELECT COUNT(*)::text AS variant_count
        FROM product_variants
        WHERE finish_id = $1
          AND deleted_at IS NULL
      `,
      [finishId]
    );

    await client.query("COMMIT");

    return NextResponse.json({
      finish: mapDoorFinishRow({
        ...result.rows[0],
        variant_count: count.rows[0]?.variant_count ?? "0",
      }),
    });
  } catch (error) {
    await client.query("ROLLBACK");

    if (error instanceof Error && error.message.includes("duplicate key")) {
      return NextResponse.json(
        { error: "A finish with this name or slug already exists" },
        { status: 409 }
      );
    }

    console.error("PATCH /api/admin/finishes/[id] failed:", error);
    return NextResponse.json({ error: "Failed to update finish" }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("can_delete_finishes");

  if (auth.response) {
    return auth.response;
  }

  const userId = auth.user!.id;
  const { id } = await context.params;
  const finishId = Number.parseInt(id, 10);

  if (Number.isNaN(finishId)) {
    return NextResponse.json({ error: "Invalid finish id" }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const deleted = await softDeleteFinish(finishId, userId, client);

    if (!deleted) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Finish not found" }, { status: 404 });
    }

    await client.query("COMMIT");
    return NextResponse.json({ success: true });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("DELETE /api/admin/finishes/[id] failed:", error);
    return NextResponse.json({ error: "Failed to delete finish" }, { status: 500 });
  } finally {
    client.release();
  }
}
