import { NextResponse } from "next/server";
import { requireAdminPermission, requireAnyAdminPermission } from "@/lib/api-auth";
import {
  getAdminCategories,
  parseUpsertCategoryBody,
} from "@/lib/catalog-categories";
import { logCategoryCreated } from "@/lib/catalog-structure-audit-log";
import { query } from "@/lib/db";

type CategoryRow = {
  id: number;
  name: string;
  slug: string;
};

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
    const categories = await getAdminCategories();
    return NextResponse.json({ categories });
  } catch (error) {
    console.error("GET /api/admin/categories failed:", error);
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminPermission("can_add_products");

  if (auth.response) {
    return auth.response;
  }

  const body = parseUpsertCategoryBody(await request.json());

  if (!body) {
    return NextResponse.json({ error: "Invalid category payload" }, { status: 400 });
  }

  try {
    const result = await query<CategoryRow>(
      `
        INSERT INTO categories (name, slug)
        VALUES ($1, $2)
        RETURNING id, name, slug
      `,
      [body.name, body.slug]
    );

    const category = result.rows[0];

    await logCategoryCreated({
      adminUserId: auth.user!.id,
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug,
      },
    });

    return NextResponse.json(
      {
        category: {
          ...category,
          productCount: 0,
          subCategories: [],
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("duplicate key")) {
      return NextResponse.json(
        { error: "A category with this name or slug already exists" },
        { status: 409 }
      );
    }

    console.error("POST /api/admin/categories failed:", error);
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
  }
}
