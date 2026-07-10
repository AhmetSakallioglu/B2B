import { NextResponse } from "next/server";
import { requireAnyAdminPermission } from "@/lib/api-auth";
import { getCatalogCategories } from "@/lib/catalog-categories";

export async function GET() {
  const auth = await requireAnyAdminPermission([
    "can_view_products",
    "can_add_products",
    "can_delete_products",
    "can_toggle_products",
    "can_bulk_upload_products",
  ]);

  if (auth.response) {
    return auth.response;
  }

  try {
    const categories = await getCatalogCategories();
    return NextResponse.json({ categories });
  } catch (error) {
    console.error("GET /api/admin/catalog failed:", error);
    return NextResponse.json({ error: "Failed to fetch catalog metadata" }, { status: 500 });
  }
}
