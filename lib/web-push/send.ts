import webpush from "web-push";
import { getAppBaseUrl } from "@/lib/app-url";
import { getWebPushHttpsAgent } from "@/lib/web-push/https-agent";
import { deleteAdminPushSubscriptionByEndpoint } from "@/lib/web-push/subscriptions";
import { ensureWebPushConfigured } from "@/lib/web-push/vapid";
import type { AdminPushNotificationPayload, AdminPushPermissionTarget } from "@/types/web-push";
import { listAdminPushSubscriptionsForPermission } from "@/lib/web-push/subscriptions";

const DEFAULT_ICON = "/logo/cabinetto.png";

function isExpiredSubscriptionStatus(statusCode?: number) {
  return statusCode === 404 || statusCode === 410;
}

export function dispatchAdminPush(task: () => Promise<void>) {
  void task().catch((error) => {
    console.error("[web-push:dispatch-failed]", error);
  });
}

function formatPushError(error: unknown) {
  if (!error || typeof error !== "object") {
    return { message: String(error) };
  }

  const record = error as { statusCode?: number; body?: string; message?: string };
  return {
    statusCode: record.statusCode,
    body: record.body,
    message: record.message,
  };
}

export async function sendAdminPushToPermissionTarget(
  permission: AdminPushPermissionTarget,
  notification: AdminPushNotificationPayload
) {
  if (!ensureWebPushConfigured()) {
    console.info("[web-push:skipped-not-configured]", {
      title: notification.title,
      permission,
    });
    return;
  }

  const subscriptions = await listAdminPushSubscriptionsForPermission(permission);

  if (subscriptions.length === 0) {
    console.info("[web-push:no-subscriptions]", {
      title: notification.title,
      permission,
    });
    return;
  }

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    icon: notification.icon ?? DEFAULT_ICON,
    tag: notification.tag ?? "cabinetto-admin",
    url: notification.url ?? "/admin",
  });

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        const response = await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth_secret,
            },
          },
          payload,
          { agent: getWebPushHttpsAgent() }
        );

        console.info("[web-push:sent]", {
          subscriptionId: subscription.id,
          userId: subscription.user_id,
          statusCode: response.statusCode,
          title: notification.title,
        });
      } catch (error) {
        const formatted = formatPushError(error);
        const statusCode = formatted.statusCode;

        if (isExpiredSubscriptionStatus(statusCode)) {
          await deleteAdminPushSubscriptionByEndpoint(subscription.endpoint);
        }

        console.error("[web-push:send-failed]", {
          subscriptionId: subscription.id,
          userId: subscription.user_id,
          ...formatted,
        });
      }
    })
  );
}

export function adminPushUrl(path: string) {
  const baseUrl = getAppBaseUrl();
  return path.startsWith("/") ? `${baseUrl}${path}` : `${baseUrl}/${path}`;
}
