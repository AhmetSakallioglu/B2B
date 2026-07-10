import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/api-auth";
import {
  countProductsInSubCategory,
  parseUpsertSubCategoryBody,
} from "@/lib/catalog-categories";
import {
  logSubCategoryDeleted,
  logSubCategoryUpdated,
} from "@/lib/catalog-structure-audit-log";
import { query } from "@/lib/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type SubCategoryRow = {
  id: number;
  category_id: number;
  name: string;
  slug: string;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("can_add_products");

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const subCategoryId = Number.parseInt(id, 10);

  if (Number.isNaN(subCategoryId)) {
    return NextResponse.json({ error: "Invalid subcategory id" }, { status: 400 });
  }

  const body = parseUpsertSubCategoryBody(await request.json());

  if (!body) {
    return NextResponse.json({ error: "Invalid subcategory payload" }, { status: 400 });
  }

  try {
    const existing = await query<SubCategoryRow>(
      "SELECT id, category_id, name, slug FROM sub_categories WHERE id = $1",
      [subCategoryId]
    );

    if (existing.rows.length === 0) {
      return NextResponse.json({ error: "Subcategory not found" }, { status: 404 });
    }

    const before = existing.rows[0];

    const result = await query<SubCategoryRow>(
      `
        UPDATE sub_categories
        SET
          category_id = $2,
          name = $3,
          slug = $4
        WHERE id = $1
        RETURNING id, category_id, name, slug
      `,
      [subCategoryId, body.categoryId, body.name, body.slug]
    );

    const after = result.rows[0];

    await logSubCategoryUpdated({
      adminUserId: auth.user!.id,
      before: {
        id: before.id,
        categoryId: before.category_id,
        name: before.name,
        slug: before.slug,
      },
      after: {
        id: after.id,
        categoryId: after.category_id,
        name: after.name,
        slug: after.slug,
      },
    });

    return NextResponse.json({ subCategory: after });
  } catch (error) {
    if (error instanceof Error && error.message.includes("duplicate key")) {
      return NextResponse.json(
        { error: "A subcategory with this slug already exists in this category" },
        { status: 409 }
      );
    }

    console.error("PATCH /api/admin/subcategories/[id] failed:", error);
    return NextResponse.json({ error: "Failed to update subcategory" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("can_delete_products");

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const subCategoryId = Number.parseInt(id, 10);

  if (Number.isNaN(subCategoryId)) {
    return NextResponse.json({ error: "Invalid subcategory id" }, { status: 400 });
  }

  try {
    const productCount = await countProductsInSubCategory(subCategoryId);

    if (productCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete a subcategory that still has products" },
        { status: 409 }
      );
    }

    const existing = await query<SubCategoryRow>(
      "SELECT id, category_id, name, slug FROM sub_categories WHERE id = $1",
      [subCategoryId]
    );

    if (existing.rows.length === 0) {
      return NextResponse.json({ error: "Subcategory not found" }, { status: 404 });
    }

    await query("DELETE FROM sub_categories WHERE id = $1", [subCategoryId]);

    const subCategory = existing.rows[0];

    await logSubCategoryDeleted({
      adminUserId: auth.user!.id,
      subCategory: {
        id: subCategory.id,
        categoryId: subCategory.category_id,
        name: subCategory.name,
        slug: subCategory.slug,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/subcategories/[id] failed:", error);
    return NextResponse.json({ error: "Failed to delete subcategory" }, { status: 500 });
  }
}
