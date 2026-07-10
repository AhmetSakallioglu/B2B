import { query } from "@/lib/db";
import type { AdminPushSubscriptionPayload } from "@/types/web-push";
import type { AdminPushPermissionTarget } from "@/types/web-push";

type StoredPushSubscription = {
  id: number;
  user_id: number;
  endpoint: string;
  p256dh: string;
  auth_secret: string;
};

const PERMISSION_FILTER_SQL: Record<AdminPushPermissionTarget, string> = {
  can_approve_users: "ap.can_approve_users = true",
  can_view_orders: "ap.can_view_orders = true",
};

export function parsePushSubscriptionBody(body: unknown): AdminPushSubscriptionPayload | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const candidate = body as Record<string, unknown>;
  const endpoint = typeof candidate.endpoint === "string" ? candidate.endpoint.trim() : "";
  const keys =
    candidate.keys && typeof candidate.keys === "object"
      ? (candidate.keys as Record<string, unknown>)
      : null;

  const p256dh = typeof keys?.p256dh === "string" ? keys.p256dh.trim() : "";
  const auth = typeof keys?.auth === "string" ? keys.auth.trim() : "";

  if (!endpoint || !p256dh || !auth) {
    return null;
  }

  const expirationTime =
    typeof candidate.expirationTime === "number" && Number.isFinite(candidate.expirationTime)
      ? candidate.expirationTime
      : null;

  return {
    endpoint,
    expirationTime,
    keys: { p256dh, auth },
  };
}

export async function upsertAdminPushSubscription(params: {
  userId: number;
  subscription: AdminPushSubscriptionPayload;
  userAgent?: string | null;
}) {
  await query(
    `
      INSERT INTO admin_push_subscriptions (
        user_id,
        endpoint,
        p256dh,
        auth_secret,
        user_agent,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (user_id, endpoint)
      DO UPDATE SET
        p256dh = EXCLUDED.p256dh,
        auth_secret = EXCLUDED.auth_secret,
        user_agent = EXCLUDED.user_agent,
        updated_at = NOW()
    `,
    [
      params.userId,
      params.subscription.endpoint,
      params.subscription.keys.p256dh,
      params.subscription.keys.auth,
      params.userAgent ?? null,
    ]
  );
}

export async function deleteAdminPushSubscriptionByEndpoint(endpoint: string) {
  await query(`DELETE FROM admin_push_subscriptions WHERE endpoint = $1`, [endpoint]);
}

export async function listAdminPushSubscriptionsForPermission(
  permission: AdminPushPermissionTarget
): Promise<StoredPushSubscription[]> {
  const permissionFilter = PERMISSION_FILTER_SQL[permission];

  const result = await query<StoredPushSubscription>(
    `
      SELECT
        s.id,
        s.user_id,
        s.endpoint,
        s.p256dh,
        s.auth_secret
      FROM admin_push_subscriptions s
      JOIN users u ON u.id = s.user_id AND u.role = 'admin'
      LEFT JOIN admin_permissions ap ON ap.user_id = u.id
      WHERE
        ap.user_id IS NULL
        OR ap.is_super_admin = true
        OR ${permissionFilter}
    `
  );

  return result.rows;
}
