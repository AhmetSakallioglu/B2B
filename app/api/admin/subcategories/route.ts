import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/api-auth";
import { parseUpsertSubCategoryBody } from "@/lib/catalog-categories";
import { logSubCategoryCreated } from "@/lib/catalog-structure-audit-log";
import { query } from "@/lib/db";

type SubCategoryRow = {
  id: number;
  category_id: number;
  name: string;
  slug: string;
};

export async function POST(request: Request) {
  const auth = await requireAdminPermission("can_add_products");

  if (auth.response) {
    return auth.response;
  }

  const body = parseUpsertSubCategoryBody(await request.json());

  if (!body) {
    return NextResponse.json({ error: "Invalid subcategory payload" }, { status: 400 });
  }

  try {
    const categoryExists = await query<{ id: number }>(
      "SELECT id FROM categories WHERE id = $1",
      [body.categoryId]
    );

    if (categoryExists.rows.length === 0) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const result = await query<SubCategoryRow>(
      `
        INSERT INTO sub_categories (category_id, name, slug)
        VALUES ($1, $2, $3)
        RETURNING id, category_id, name, slug
      `,
      [body.categoryId, body.name, body.slug]
    );

    const row = result.rows[0];

    await logSubCategoryCreated({
      adminUserId: auth.user!.id,
      subCategory: {
        id: row.id,
        categoryId: row.category_id,
        name: row.name,
        slug: row.slug,
      },
    });

    return NextResponse.json(
      {
        subCategory: {
          id: row.id,
          name: row.name,
          slug: row.slug,
          productCount: 0,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("duplicate key")) {
      return NextResponse.json(
        { error: "A subcategory with this slug already exists in this category" },
        { status: 409 }
      );
    }

    console.error("POST /api/admin/subcategories failed:", error);
    return NextResponse.json({ error: "Failed to create subcategory" }, { status: 500 });
  }
}
