import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/api-auth";
import { buildBulkUploadTemplateBuffer } from "@/lib/product-bulk-upload";

export async function GET() {
  const auth = await requireAdminPermission("can_bulk_upload_products");

  if (auth.response) {
    return auth.response;
  }

  try {
    const buffer = buildBulkUploadTemplateBuffer();

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="cabinet-bulk-upload-template.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/admin/products/bulk-upload/template failed:", error);
    return NextResponse.json(
      { error: "Failed to generate bulk upload template" },
      { status: 500 }
    );
  }
}
