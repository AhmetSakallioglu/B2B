import { logAdminPermissionsChange } from "@/lib/admin-audit-log";
import { query } from "@/lib/db";
import {
  ADMIN_PERMISSION_KEYS,
  createEmptyAdminPermissions,
  mapAdminPermissionsRow,
  PERMISSION_FORBIDDEN_MESSAGE,
  type AdminPermissionKey,
  type AdminPermissions,
  type AdminPermissionsRow,
} from "@/types/admin-permissions";

const ADMIN_PERMISSIONS_SELECT = `
  user_id,
  is_super_admin,
  ${ADMIN_PERMISSION_KEYS.join(",\n  ")},
  updated_at,
  updated_by
`;

export async function getAdminPermissions(userId: number): Promise<AdminPermissions> {
  const result = await query<AdminPermissionsRow>(
    `
      SELECT ${ADMIN_PERMISSIONS_SELECT}
      FROM admin_permissions
      WHERE user_id = $1
    `,
    [userId]
  );

  if (result.rows[0]) {
    return mapAdminPermissionsRow(result.rows[0]);
  }

  const user = await query<{ role: string }>(
    "SELECT role FROM users WHERE id = $1",
    [userId]
  );

  if (user.rows[0]?.role !== "admin") {
    return createEmptyAdminPermissions();
  }

  await ensureAdminPermissionsRow(userId);
  return getAdminPermissions(userId);
}

export async function ensureAdminPermissionsRow(userId: number) {
  await query(
    `
      INSERT INTO admin_permissions (user_id)
      VALUES ($1)
      ON CONFLICT (user_id) DO NOTHING
    `,
    [userId]
  );
}

export async function isSuperAdmin(userId: number) {
  const permissions = await getAdminPermissions(userId);
  return permissions.isSuperAdmin;
}

export async function getAdminPermissionsForUser(userId: number) {
  return getAdminPermissions(userId);
}

export async function updateAdminPermissions(
  targetUserId: number,
  permissions: AdminPermissions,
  updatedBy: number
) {
  const existing = await getAdminPermissions(targetUserId);

  if (existing.isSuperAdmin) {
    throw new Error("SUPER_ADMIN_LOCKED");
  }

  const permissionAssignments = ADMIN_PERMISSION_KEYS.map(
    (key, index) => `${key} = $${index + 2}`
  ).join(",\n        ");

  const values = ADMIN_PERMISSION_KEYS.map((key) => permissions[key]);

  await query(
    `
      UPDATE admin_permissions
      SET
        is_super_admin = false,
        ${permissionAssignments},
        updated_at = NOW(),
        updated_by = $${ADMIN_PERMISSION_KEYS.length + 2}
      WHERE user_id = $1
    `,
    [targetUserId, ...values, updatedBy]
  );

  const updatedPermissions = await getAdminPermissions(targetUserId);

  await logAdminPermissionsChange({
    adminUserId: updatedBy,
    targetUserId,
    oldPermissions: existing,
    newPermissions: updatedPermissions,
  });

  return updatedPermissions;
}

export async function listAdminUsersWithPermissions() {
  const permissionColumns = ADMIN_PERMISSION_KEYS.map(
    (key) => `COALESCE(ap.${key}, false) AS ${key}`
  ).join(",\n        ");

  const result = await query<
    AdminPermissionsRow & { email: string; role: string }
  >(
    `
      SELECT
        u.id AS user_id,
        u.email,
        u.role,
        COALESCE(ap.is_super_admin, false) AS is_super_admin,
        ${permissionColumns}
      FROM users u
      LEFT JOIN admin_permissions ap ON ap.user_id = u.id
      WHERE u.role = 'admin'
      ORDER BY u.created_at ASC, u.id ASC
    `
  );

  return result.rows.map((row) => ({
    userId: row.user_id,
    email: row.email,
    role: row.role,
    permissions: mapAdminPermissionsRow(row),
  }));
}

export function permissionDeniedResponse() {
  return {
    error: PERMISSION_FORBIDDEN_MESSAGE,
  };
}

export type { AdminPermissionKey, AdminPermissions };
