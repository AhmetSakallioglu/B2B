import { query } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit-log";
import {
  ADMIN_PERMISSION_KEYS,
  getAdminPermissionLabel,
  type AdminPermissionKey,
  type AdminPermissions,
} from "@/types/admin-permissions";

export type TierAuditSnapshot = {
  id: number;
  name: string;
  level: number;
  discount_percent: number;
  description: string | null;
};

export type UserTierAuditSnapshot = {
  tier_id: number | null;
  tier_name: string | null;
  discount_percent: number | null;
};

export type UserStatusAuditSnapshot = {
  email: string;
  account_status: string;
};

function serializeRow<T extends Record<string, unknown>>(row: T | null) {
  if (!row) {
    return null;
  }

  return JSON.parse(JSON.stringify(row)) as Record<string, unknown>;
}

export async function fetchTierAuditSnapshot(tierId: number) {
  const result = await query<TierAuditSnapshot>(
    `
      SELECT id, name, level, discount_percent, description
      FROM customer_tiers
      WHERE id = $1
    `,
    [tierId]
  );

  return result.rows[0] ?? null;
}

export async function fetchUserTierAuditSnapshot(userId: number) {
  const result = await query<{
    tier_id: number | null;
    tier_name: string | null;
    discount_percent: string | null;
  }>(
    `
      SELECT
        u.tier_id,
        ct.name AS tier_name,
        ct.discount_percent
      FROM users u
      LEFT JOIN customer_tiers ct ON ct.id = u.tier_id
      WHERE u.id = $1
    `,
    [userId]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    tier_id: row.tier_id,
    tier_name: row.tier_name,
    discount_percent:
      row.discount_percent === null ? null : Number.parseFloat(row.discount_percent),
  } satisfies UserTierAuditSnapshot;
}

export async function fetchUserStatusAuditSnapshot(userId: number) {
  const result = await query<UserStatusAuditSnapshot>(
    `
      SELECT email, account_status
      FROM users
      WHERE id = $1
    `,
    [userId]
  );

  return result.rows[0] ?? null;
}

export async function logUserTierChange(params: {
  adminUserId: number;
  targetUserId: number;
  oldTier: UserTierAuditSnapshot | null;
  newTier: UserTierAuditSnapshot | null;
}) {
  if (
    params.oldTier?.tier_id === params.newTier?.tier_id &&
    params.oldTier?.tier_name === params.newTier?.tier_name &&
    params.oldTier?.discount_percent === params.newTier?.discount_percent
  ) {
    return;
  }

  const status = await fetchUserStatusAuditSnapshot(params.targetUserId);

  await writeAuditLog({
    userId: params.adminUserId,
    action: "UPDATE",
    tableName: "users",
    recordId: params.targetUserId,
    oldValues: {
      email: status?.email ?? null,
      tier: params.oldTier,
    },
    newValues: {
      email: status?.email ?? null,
      tier: params.newTier,
    },
  });
}

export async function logUserProfileUpdated(params: {
  adminUserId: number;
  targetUserId: number;
  oldValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
}) {
  const changedKeys = Object.keys(params.newValues).filter(
    (key) => JSON.stringify(params.oldValues[key]) !== JSON.stringify(params.newValues[key])
  );

  if (changedKeys.length === 0) {
    return;
  }

  const [adminEmail, targetEmail] = await Promise.all([
    fetchUserEmail(params.adminUserId),
    fetchUserEmail(params.targetUserId),
  ]);

  await writeAuditLog({
    userId: params.adminUserId,
    action: "UPDATE",
    tableName: "users",
    recordId: params.targetUserId,
    oldValues: params.oldValues,
    newValues: {
      ...params.newValues,
      summary: `${adminEmail} updated profile for ${targetEmail} (${changedKeys.join(", ")}).`,
    },
  });
}

export async function logUserCreated(params: {
  adminUserId: number;
  userId: number;
  email: string;
  accountStatus: string;
}) {
  await writeAuditLog({
    userId: params.adminUserId,
    action: "CREATE",
    tableName: "users",
    recordId: params.userId,
    newValues: {
      email: params.email,
      account_status: params.accountStatus,
      event: "admin_create",
    },
  });
}

export async function logUserStatusChange(params: {
  adminUserId: number;
  targetUserId: number;
  oldStatus: UserStatusAuditSnapshot;
  newStatus: UserStatusAuditSnapshot;
}) {
  if (params.oldStatus.account_status === params.newStatus.account_status) {
    return;
  }

  await writeAuditLog({
    userId: params.adminUserId,
    action: "UPDATE",
    tableName: "users",
    recordId: params.targetUserId,
    oldValues: serializeRow(params.oldStatus),
    newValues: serializeRow(params.newStatus),
  });
}

export async function logTierCreate(params: {
  adminUserId: number;
  tier: TierAuditSnapshot;
}) {
  await writeAuditLog({
    userId: params.adminUserId,
    action: "CREATE",
    tableName: "customer_tiers",
    recordId: params.tier.id,
    newValues: serializeRow(params.tier),
  });
}

export async function logTierUpdate(params: {
  adminUserId: number;
  tierId: number;
  oldTier: TierAuditSnapshot;
  newTier: TierAuditSnapshot;
}) {
  await writeAuditLog({
    userId: params.adminUserId,
    action: "UPDATE",
    tableName: "customer_tiers",
    recordId: params.tierId,
    oldValues: serializeRow(params.oldTier),
    newValues: serializeRow(params.newTier),
  });
}

export async function logTierDelete(params: {
  adminUserId: number;
  tier: TierAuditSnapshot;
}) {
  await writeAuditLog({
    userId: params.adminUserId,
    action: "SOFT_DELETE",
    tableName: "customer_tiers",
    recordId: params.tier.id,
    oldValues: serializeRow(params.tier),
    newValues: { deleted: true },
  });
}

function permissionsToAuditSnapshot(permissions: AdminPermissions) {
  return Object.fromEntries(
    ADMIN_PERMISSION_KEYS.map((key) => [key, permissions[key]])
  ) as Record<AdminPermissionKey, boolean>;
}

function diffAdminPermissions(oldPermissions: AdminPermissions, newPermissions: AdminPermissions) {
  const enabled: AdminPermissionKey[] = [];
  const disabled: AdminPermissionKey[] = [];

  for (const key of ADMIN_PERMISSION_KEYS) {
    if (oldPermissions[key] === newPermissions[key]) {
      continue;
    }

    if (newPermissions[key]) {
      enabled.push(key);
    } else {
      disabled.push(key);
    }
  }

  return { enabled, disabled };
}

async function fetchUserEmail(userId: number) {
  const result = await query<{ email: string }>(
    `SELECT email FROM users WHERE id = $1`,
    [userId]
  );

  return result.rows[0]?.email ?? `user #${userId}`;
}

function formatPermissionChangeList(keys: AdminPermissionKey[]) {
  return keys.map((key) => getAdminPermissionLabel(key)).join(", ");
}

export async function logAdminPermissionsChange(params: {
  adminUserId: number;
  targetUserId: number;
  oldPermissions: AdminPermissions;
  newPermissions: AdminPermissions;
}) {
  const { enabled, disabled } = diffAdminPermissions(
    params.oldPermissions,
    params.newPermissions
  );

  if (enabled.length === 0 && disabled.length === 0) {
    return;
  }

  const [adminEmail, targetEmail] = await Promise.all([
    fetchUserEmail(params.adminUserId),
    fetchUserEmail(params.targetUserId),
  ]);

  const changeParts: string[] = [];

  if (enabled.length > 0) {
    changeParts.push(`enabled ${formatPermissionChangeList(enabled)}`);
  }

  if (disabled.length > 0) {
    changeParts.push(`disabled ${formatPermissionChangeList(disabled)}`);
  }

  await writeAuditLog({
    userId: params.adminUserId,
    action: "UPDATE",
    tableName: "admin_permissions",
    recordId: params.targetUserId,
    oldValues: {
      target_email: targetEmail,
      permissions: permissionsToAuditSnapshot(params.oldPermissions),
    },
    newValues: {
      target_email: targetEmail,
      permissions: permissionsToAuditSnapshot(params.newPermissions),
      enabled,
      disabled,
      summary: `${adminEmail} ${changeParts.join(" and ")} for admin ${targetEmail}.`,
    },
  });
}

export async function cleanupAuditLogsOlderThanDays(days: number) {
  const batchSize = 5000;
  let deletedCount = 0;

  while (true) {
    const result = await query<{ count: string }>(
      `
        WITH deleted AS (
          DELETE FROM audit_logs
          WHERE id IN (
            SELECT id
            FROM audit_logs
            WHERE created_at < NOW() - ($1 || ' days')::interval
            ORDER BY id
            LIMIT $2
          )
          RETURNING id
        )
        SELECT COUNT(*)::text AS count FROM deleted
      `,
      [String(days), batchSize]
    );

    const batchDeleted = Number.parseInt(result.rows[0]?.count ?? "0", 10);

    if (batchDeleted === 0) {
      break;
    }

    deletedCount += batchDeleted;

    if (batchDeleted < batchSize) {
      break;
    }
  }

  return deletedCount;
}
