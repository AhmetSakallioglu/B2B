import { NextResponse } from "next/server";
import { mapPublicDoorFinish } from "@/lib/door-finish";
import { query } from "@/lib/db";
import type { DoorFinishRow } from "@/types/door-finish";

export async function GET() {
  try {
    const result = await query<DoorFinishRow>(
      `
        SELECT
          df.id,
          df.name,
          df.slug,
          df.description,
          df.sample_image_url,
          df.sort_order,
          df.is_active,
          COUNT(pv.id)::text AS variant_count
        FROM door_finishes df
        LEFT JOIN product_variants pv ON pv.finish_id = df.id AND pv.deleted_at IS NULL
        WHERE df.is_active = true
          AND df.deleted_at IS NULL
        GROUP BY df.id
        HAVING COUNT(pv.id) > 0
        ORDER BY df.sort_order ASC, df.name ASC
      `
    );

    return NextResponse.json({
      finishes: result.rows.map(mapPublicDoorFinish),
    });
  } catch (error) {
    console.error("GET /api/catalog/finishes failed:", error);
    return NextResponse.json({ error: "Failed to fetch door finishes" }, { status: 500 });
  }
}
