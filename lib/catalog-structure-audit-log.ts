import { writeAuditLog } from "@/lib/audit-log";
import { query } from "@/lib/db";

async function fetchAdminEmail(adminUserId: number) {
  const result = await query<{ email: string }>(
    `SELECT email FROM users WHERE id = $1`,
    [adminUserId]
  );

  return result.rows[0]?.email ?? `admin #${adminUserId}`;
}

type CategorySnapshot = {
  id: number;
  name: string;
  slug: string;
};

type SubCategorySnapshot = {
  id: number;
  categoryId: number;
  name: string;
  slug: string;
};

export async function logCategoryCreated(params: {
  adminUserId: number;
  category: CategorySnapshot;
}) {
  const adminEmail = await fetchAdminEmail(params.adminUserId);

  await writeAuditLog({
    userId: params.adminUserId,
    action: "CREATE",
    tableName: "categories",
    recordId: params.category.id,
    newValues: {
      name: params.category.name,
      slug: params.category.slug,
      summary: `${adminEmail} created category "${params.category.name}".`,
    },
  });
}

export async function logCategoryUpdated(params: {
  adminUserId: number;
  before: CategorySnapshot;
  after: CategorySnapshot;
}) {
  const adminEmail = await fetchAdminEmail(params.adminUserId);

  await writeAuditLog({
    userId: params.adminUserId,
    action: "UPDATE",
    tableName: "categories",
    recordId: params.after.id,
    oldValues: {
      name: params.before.name,
      slug: params.before.slug,
    },
    newValues: {
      name: params.after.name,
      slug: params.after.slug,
      summary: `${adminEmail} updated category "${params.before.name}" to "${params.after.name}".`,
    },
  });
}

export async function logCategoryDeleted(params: {
  adminUserId: number;
  category: CategorySnapshot;
}) {
  const adminEmail = await fetchAdminEmail(params.adminUserId);

  await writeAuditLog({
    userId: params.adminUserId,
    action: "SOFT_DELETE",
    tableName: "categories",
    recordId: params.category.id,
    oldValues: {
      name: params.category.name,
      slug: params.category.slug,
    },
    newValues: {
      summary: `${adminEmail} deleted category "${params.category.name}".`,
    },
  });
}

export async function logSubCategoryCreated(params: {
  adminUserId: number;
  subCategory: SubCategorySnapshot;
}) {
  const adminEmail = await fetchAdminEmail(params.adminUserId);

  await writeAuditLog({
    userId: params.adminUserId,
    action: "CREATE",
    tableName: "sub_categories",
    recordId: params.subCategory.id,
    newValues: {
      category_id: params.subCategory.categoryId,
      name: params.subCategory.name,
      slug: params.subCategory.slug,
      summary: `${adminEmail} created subcategory "${params.subCategory.name}".`,
    },
  });
}

export async function logSubCategoryUpdated(params: {
  adminUserId: number;
  before: SubCategorySnapshot;
  after: SubCategorySnapshot;
}) {
  const adminEmail = await fetchAdminEmail(params.adminUserId);

  await writeAuditLog({
    userId: params.adminUserId,
    action: "UPDATE",
    tableName: "sub_categories",
    recordId: params.after.id,
    oldValues: {
      category_id: params.before.categoryId,
      name: params.before.name,
      slug: params.before.slug,
    },
    newValues: {
      category_id: params.after.categoryId,
      name: params.after.name,
      slug: params.after.slug,
      summary: `${adminEmail} updated subcategory "${params.before.name}" to "${params.after.name}".`,
    },
  });
}

export async function logSubCategoryDeleted(params: {
  adminUserId: number;
  subCategory: SubCategorySnapshot;
}) {
  const adminEmail = await fetchAdminEmail(params.adminUserId);

  await writeAuditLog({
    userId: params.adminUserId,
    action: "SOFT_DELETE",
    tableName: "sub_categories",
    recordId: params.subCategory.id,
    oldValues: {
      category_id: params.subCategory.categoryId,
      name: params.subCategory.name,
      slug: params.subCategory.slug,
    },
    newValues: {
      summary: `${adminEmail} deleted subcategory "${params.subCategory.name}".`,
    },
  });
}
