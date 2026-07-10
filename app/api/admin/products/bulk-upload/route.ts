import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/api-auth";
import { pool } from "@/lib/db";
import { logProductBulkUpload } from "@/lib/product-catalog-audit-log";
import { parseBulkUploadFile, processBulkUploadRows } from "@/lib/product-bulk-upload";

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;

const ALLOWED_EXTENSIONS = [".xlsx", ".xls", ".csv"];

function isAllowedBulkUploadFile(file: File) {
  const lowerName = file.name.toLowerCase();
  return ALLOWED_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
}

export async function POST(request: Request) {
  const auth = await requireAdminPermission("can_bulk_upload_products");

  if (auth.response) {
    return auth.response;
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Upload file is required" }, { status: 400 });
    }

    if (!isAllowedBulkUploadFile(file)) {
      return NextResponse.json(
        { error: "Only .xlsx, .xls, and .csv files are supported" },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json({ error: "Uploaded file is empty" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File is too large. Maximum size is 8 MB." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { rows, errors: parseErrors } = parseBulkUploadFile(buffer, file.name);

    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const result = await processBulkUploadRows(client, rows, parseErrors);
      await client.query("COMMIT");

      const processedCount = result.createdVariants + result.updatedVariants;

      if (processedCount === 0) {
        return NextResponse.json(
          {
            error: "No variants were imported. Review the row errors and try again.",
            ...result,
          },
          { status: 400 }
        );
      }

      await logProductBulkUpload({
        adminUserId: auth.user!.id,
        fileName: file.name,
        createdVariants: result.createdVariants,
        updatedVariants: result.updatedVariants,
        errorCount: result.errors.length,
      });

      return NextResponse.json({
        success: true,
        message: `${processedCount} variant(s) imported successfully (${result.createdVariants} created, ${result.updatedVariants} updated).`,
        ...result,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("POST /api/admin/products/bulk-upload failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to process bulk upload",
      },
      { status: 500 }
    );
  }
}
