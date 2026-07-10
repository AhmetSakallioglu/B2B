import { NextResponse } from "next/server";
import { requireAdminPermission, requireAnyAdminPermission } from "@/lib/api-auth";
import {
  DOOR_FINISH_SELECT,
  mapDoorFinishRow,
  parseUpsertDoorFinishBody,
} from "@/lib/door-finish";
import { fetchFinishSnapshot, writeAuditLog } from "@/lib/audit-log";
import { query } from "@/lib/db";
import type { DoorFinishRow } from "@/types/door-finish";

export async function GET() {
  const auth = await requireAnyAdminPermission([
    "can_add_finishes",
    "can_delete_finishes",
    "can_toggle_finishes",
  ]);

  if (auth.response) {
    return auth.response;
  }

  try {
    const result = await query<DoorFinishRow>(
      `
        SELECT
          ${DOOR_FINISH_SELECT},
          COUNT(DISTINCT pv.id)::text AS variant_count,
          COUNT(DISTINCT ci.id)::text AS cart_items_count
        FROM door_finishes df
        LEFT JOIN product_variants pv ON pv.finish_id = df.id AND pv.deleted_at IS NULL
        LEFT JOIN cart_items ci ON ci.variant_id = pv.id
        WHERE df.deleted_at IS NULL
        GROUP BY df.id
        ORDER BY df.sort_order ASC, df.name ASC
      `
    );

    return NextResponse.json({
      finishes: result.rows.map(mapDoorFinishRow),
    });
  } catch (error) {
    console.error("GET /api/admin/finishes failed:", error);
    return NextResponse.json({ error: "Failed to fetch finishes" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminPermission("can_add_finishes");

  if (auth.response) {
    return auth.response;
  }

  const body = parseUpsertDoorFinishBody(await request.json());

  if (!body) {
    return NextResponse.json({ error: "Invalid finish payload" }, { status: 400 });
  }

  try {
    const finishImages = body.finishImages ?? (body.sampleImageUrl ? [body.sampleImageUrl] : []);

    const result = await query<DoorFinishRow>(
      `
        INSERT INTO door_finishes (
          name,
          slug,
          description,
          sample_image_url,
          finish_images,
          sort_order,
          is_active,
          created_by,
          updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
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
      [
        body.name,
        body.slug,
        body.description || null,
        body.sampleImageUrl ?? finishImages[0] ?? null,
        finishImages,
        body.sortOrder,
        body.isActive,
        auth.user!.id,
      ]
    );

    const finishAfter = await fetchFinishSnapshot(result.rows[0].id);

    if (finishAfter) {
      await writeAuditLog({
        userId: auth.user!.id,
        action: "CREATE",
        tableName: "door_finishes",
        recordId: result.rows[0].id,
        newValues: JSON.parse(JSON.stringify(finishAfter)),
      });
    }

    return NextResponse.json(
      { finish: mapDoorFinishRow({ ...result.rows[0], variant_count: "0", cart_items_count: "0" }) },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("duplicate key")) {
      return NextResponse.json(
        { error: "A finish with this name or slug already exists" },
        { status: 409 }
      );
    }

    console.error("POST /api/admin/finishes failed:", error);
    return NextResponse.json({ error: "Failed to create finish" }, { status: 500 });
  }
}
