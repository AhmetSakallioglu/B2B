import type { AdminPermissionKey } from "@/types/admin-permissions";

export type AdminPushSubscriptionKeys = {
  p256dh: string;
  auth: string;
};

export type AdminPushSubscriptionPayload = {
  endpoint: string;
  expirationTime?: number | null;
  keys: AdminPushSubscriptionKeys;
};

export type AdminPushNotificationPayload = {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  url?: string;
};

export type AdminPushPermissionTarget = Extract<
  AdminPermissionKey,
  "can_approve_users" | "can_view_orders"
>;
