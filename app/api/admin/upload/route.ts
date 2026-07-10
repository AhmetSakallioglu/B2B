import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/api-auth";
import { saveProductImage } from "@/lib/save-product-image";

export async function POST(request: Request) {
  const auth = await requireAdminPermission("can_add_products");

  if (auth.response) {
    return auth.response;
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Image file is required" }, { status: 400 });
    }

    const url = await saveProductImage(file);

    return NextResponse.json({ url }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    console.error("POST /api/admin/upload failed:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
