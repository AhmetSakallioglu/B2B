import { finishToSlug } from "@/lib/catalog-browse";
import { query } from "@/lib/db";
import type { CatalogCategory } from "@/types/admin";
import type { AdminCategory, AdminSubCategory } from "@/types/category-admin";

type CategoryRow = {
  category_id: number;
  category_name: string;
  category_slug: string;
  sub_category_id: number | null;
  sub_category_name: string | null;
  sub_category_slug: string | null;
  sub_product_count: string | null;
};

type AdminCategoryRow = CategoryRow & {
  category_product_count: string;
};

export function slugFromName(name: string) {
  return finishToSlug(name);
}

export function parseUpsertCategoryBody(body: unknown) {
  if (!body || typeof body !== "object") {
    return null;
  }

  const record = body as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name.trim() : "";

  if (!name) {
    return null;
  }

  const slugInput = typeof record.slug === "string" ? record.slug.trim() : "";
  const slug = slugInput || slugFromName(name);

  if (!slug) {
    return null;
  }

  return { name, slug };
}

export function parseUpsertSubCategoryBody(body: unknown) {
  if (!body || typeof body !== "object") {
    return null;
  }

  const record = body as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const categoryId =
    typeof record.categoryId === "number"
      ? record.categoryId
      : Number.parseInt(String(record.categoryId ?? ""), 10);

  if (!name || Number.isNaN(categoryId) || categoryId < 1) {
    return null;
  }

  const slugInput = typeof record.slug === "string" ? record.slug.trim() : "";
  const slug = slugInput || slugFromName(name);

  if (!slug) {
    return null;
  }

  return { name, slug, categoryId };
}

function mapAdminSubCategory(row: CategoryRow): AdminSubCategory | null {
  if (row.sub_category_id === null || !row.sub_category_name || !row.sub_category_slug) {
    return null;
  }

  return {
    id: row.sub_category_id,
    name: row.sub_category_name,
    slug: row.sub_category_slug,
    productCount: Number.parseInt(row.sub_product_count ?? "0", 10),
  };
}

export async function getCatalogCategories(): Promise<CatalogCategory[]> {
  const result = await query<CategoryRow>(
    `
      SELECT
        c.id AS category_id,
        c.name AS category_name,
        c.slug AS category_slug,
        sc.id AS sub_category_id,
        sc.name AS sub_category_name,
        sc.slug AS sub_category_slug,
        COUNT(p.id)::text AS sub_product_count
      FROM categories c
      LEFT JOIN sub_categories sc ON sc.category_id = c.id
      LEFT JOIN products p ON p.sub_category_id = sc.id
      GROUP BY c.id, c.name, c.slug, sc.id, sc.name, sc.slug
      ORDER BY c.name ASC, sc.name ASC NULLS LAST
    `
  );

  const categoriesMap = new Map<number, CatalogCategory>();

  for (const row of result.rows) {
    if (!categoriesMap.has(row.category_id)) {
      categoriesMap.set(row.category_id, {
        id: row.category_id,
        name: row.category_name,
        slug: row.category_slug,
        subCategories: [],
      });
    }

    const subCategory = mapAdminSubCategory(row);

    if (subCategory) {
      categoriesMap.get(row.category_id)?.subCategories.push({
        id: subCategory.id,
        name: subCategory.name,
        slug: subCategory.slug,
      });
    }
  }

  return Array.from(categoriesMap.values());
}

export async function getAdminCategories(): Promise<AdminCategory[]> {
  const result = await query<AdminCategoryRow>(
    `
      SELECT
        c.id AS category_id,
        c.name AS category_name,
        c.slug AS category_slug,
        (
          SELECT COUNT(p.id)::text
          FROM sub_categories sc2
          JOIN products p ON p.sub_category_id = sc2.id
          WHERE sc2.category_id = c.id
        ) AS category_product_count,
        sc.id AS sub_category_id,
        sc.name AS sub_category_name,
        sc.slug AS sub_category_slug,
        COUNT(p.id)::text AS sub_product_count
      FROM categories c
      LEFT JOIN sub_categories sc ON sc.category_id = c.id
      LEFT JOIN products p ON p.sub_category_id = sc.id
      GROUP BY c.id, c.name, c.slug, sc.id, sc.name, sc.slug
      ORDER BY c.name ASC, sc.name ASC NULLS LAST
    `
  );

  const categoriesMap = new Map<number, AdminCategory>();

  for (const row of result.rows) {
    if (!categoriesMap.has(row.category_id)) {
      categoriesMap.set(row.category_id, {
        id: row.category_id,
        name: row.category_name,
        slug: row.category_slug,
        productCount: Number.parseInt(row.category_product_count ?? "0", 10),
        subCategories: [],
      });
    }

    const subCategory = mapAdminSubCategory(row);

    if (subCategory) {
      categoriesMap.get(row.category_id)?.subCategories.push(subCategory);
    }
  }

  return Array.from(categoriesMap.values());
}

export async function countProductsInCategory(categoryId: number) {
  const result = await query<{ count: string }>(
    `
      SELECT COUNT(p.id)::text AS count
      FROM products p
      JOIN sub_categories sc ON sc.id = p.sub_category_id
      WHERE sc.category_id = $1
    `,
    [categoryId]
  );

  return Number.parseInt(result.rows[0]?.count ?? "0", 10);
}

export async function countProductsInSubCategory(subCategoryId: number) {
  const result = await query<{ count: string }>(
    `
      SELECT COUNT(*)::text AS count
      FROM products
      WHERE sub_category_id = $1
    `,
    [subCategoryId]
  );

  return Number.parseInt(result.rows[0]?.count ?? "0", 10);
}
