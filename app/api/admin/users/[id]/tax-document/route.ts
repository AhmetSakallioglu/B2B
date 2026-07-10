import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/api-auth";
import { query } from "@/lib/db";
import { isRemoteTaxDocumentUrl } from "@/lib/save-tax-document";
import { readStoredFile } from "@/lib/object-storage";
import path from "path";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminPermission("can_approve_users");

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const userId = Number.parseInt(id, 10);

  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  try {
    const result = await query<{ tax_document_url: string | null; resale_certificate_url: string | null }>(
      `
        SELECT tax_document_url, resale_certificate_url
        FROM users
        WHERE id = $1 AND role = 'customer'
      `,
      [userId]
    );

    const storedUrl =
      result.rows[0]?.resale_certificate_url ?? result.rows[0]?.tax_document_url;

    if (!storedUrl) {
      return NextResponse.json({ error: "Tax document not found" }, { status: 404 });
    }

    if (!storedUrl || !isRemoteTaxDocumentUrl(storedUrl)) {
      return NextResponse.json({ error: "Tax document not found" }, { status: 404 });
    }

    const buffer = await readStoredFile(storedUrl);

    if (!buffer) {
      return NextResponse.json({ error: "Tax document not found" }, { status: 404 });
    }

    const extension = path.extname(storedUrl.split("?")[0] ?? "").toLowerCase();
    const contentType = CONTENT_TYPES[extension] ?? "application/octet-stream";
    const filename = path.basename(storedUrl.split("?")[0] ?? "document");

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error(`GET /api/admin/users/${userId}/tax-document failed:`, error);
    return NextResponse.json({ error: "Failed to load tax document" }, { status: 500 });
  }
}
