import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/api-auth";
import {
  countProductsInCategory,
  parseUpsertCategoryBody,
} from "@/lib/catalog-categories";
import {
  logCategoryDeleted,
  logCategoryUpdated,
} from "@/lib/catalog-structure-audit-log";
import { query } from "@/lib/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type CategoryRow = {
  id: number;
  name: string;
  slug: string;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("can_add_products");

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const categoryId = Number.parseInt(id, 10);

  if (Number.isNaN(categoryId)) {
    return NextResponse.json({ error: "Invalid category id" }, { status: 400 });
  }

  const body = parseUpsertCategoryBody(await request.json());

  if (!body) {
    return NextResponse.json({ error: "Invalid category payload" }, { status: 400 });
  }

  try {
    const existing = await query<CategoryRow>(
      "SELECT id, name, slug FROM categories WHERE id = $1",
      [categoryId]
    );

    if (existing.rows.length === 0) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const before = existing.rows[0];

    const result = await query<CategoryRow>(
      `
        UPDATE categories
        SET name = $2, slug = $3
        WHERE id = $1
        RETURNING id, name, slug
      `,
      [categoryId, body.name, body.slug]
    );

    const after = result.rows[0];

    await logCategoryUpdated({
      adminUserId: auth.user!.id,
      before: {
        id: before.id,
        name: before.name,
        slug: before.slug,
      },
      after: {
        id: after.id,
        name: after.name,
        slug: after.slug,
      },
    });

    return NextResponse.json({ category: after });
  } catch (error) {
    if (error instanceof Error && error.message.includes("duplicate key")) {
      return NextResponse.json(
        { error: "A category with this name or slug already exists" },
        { status: 409 }
      );
    }

    console.error("PATCH /api/admin/categories/[id] failed:", error);
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("can_delete_products");

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const categoryId = Number.parseInt(id, 10);

  if (Number.isNaN(categoryId)) {
    return NextResponse.json({ error: "Invalid category id" }, { status: 400 });
  }

  try {
    const productCount = await countProductsInCategory(categoryId);

    if (productCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete a category that still has products" },
        { status: 409 }
      );
    }

    const existing = await query<CategoryRow>(
      "SELECT id, name, slug FROM categories WHERE id = $1",
      [categoryId]
    );

    if (existing.rows.length === 0) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    await query("DELETE FROM categories WHERE id = $1", [categoryId]);

    const category = existing.rows[0];

    await logCategoryDeleted({
      adminUserId: auth.user!.id,
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/categories/[id] failed:", error);
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 });
  }
}
