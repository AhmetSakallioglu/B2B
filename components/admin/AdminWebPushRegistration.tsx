"use client";

import { useCallback, useEffect, useState } from "react";
import { refreshAdminNotifications } from "@/components/admin/AdminNotificationsProvider";
import { ui } from "@/lib/ui-classes";

const PUSH_DISMISSED_KEY = "cabinetto-admin-push-banner-dismissed";

type PushConfig = {
  configured: boolean;
  publicKey: string;
  subscribed: boolean;
};

type PushUiState =
  | "loading"
  | "unsupported"
  | "not_configured"
  | "denied"
  | "ready"
  | "subscribed"
  | "error";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

function supportsWebPush() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

async function fetchPushConfig() {
  const response = await fetch("/api/admin/notifications/subscribe", { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Failed to load push configuration");
  }

  return (await response.json()) as PushConfig;
}

async function syncPushSubscription(publicKey: string) {
  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;

  const existing = await registration.pushManager.getSubscription();

  if (existing) {
    await existing.unsubscribe();
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  const response = await fetch("/api/admin/notifications/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Failed to register push subscription");
  }
}

export function AdminWebPushRegistration() {
  const [uiState, setUiState] = useState<PushUiState>("loading");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [config, setConfig] = useState<PushConfig | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const refreshState = useCallback(async () => {
    if (!supportsWebPush()) {
      setUiState("unsupported");
      return;
    }

    try {
      const nextConfig = await fetchPushConfig();
      setConfig(nextConfig);

      if (!nextConfig.configured || !nextConfig.publicKey) {
        setUiState("not_configured");
        return;
      }

      if (Notification.permission === "denied") {
        setUiState("denied");
        return;
      }

      if (nextConfig.subscribed && Notification.permission === "granted") {
        setUiState("subscribed");
        return;
      }

      setUiState("ready");
    } catch (error) {
      setUiState("error");
      setStatusMessage(error instanceof Error ? error.message : "Failed to initialize push");
    }
  }, []);

  useEffect(() => {
    setDismissed(window.sessionStorage.getItem(PUSH_DISMISSED_KEY) === "1");
    void refreshState();
  }, [refreshState]);

  const handleEnable = async () => {
    if (!config?.publicKey) {
      return;
    }

    setIsBusy(true);
    setStatusMessage(null);

    try {
      let permission = Notification.permission;

      if (permission === "default") {
        permission = await Notification.requestPermission();
      }

      if (permission !== "granted") {
        setUiState("denied");
        setStatusMessage("Browser blocked notifications. Allow them in site settings.");
        return;
      }

      await syncPushSubscription(config.publicKey);
      refreshAdminNotifications();
      await refreshState();
      setStatusMessage("Desktop notifications enabled.");
    } catch (error) {
      setUiState("error");
      setStatusMessage(error instanceof Error ? error.message : "Failed to enable notifications");
    } finally {
      setIsBusy(false);
    }
  };

  const handleTest = async () => {
    setIsBusy(true);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/admin/notifications/test", { method: "POST" });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        deliveredTo?: number;
      } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Test notification failed");
      }

      setStatusMessage(
        payload?.deliveredTo
          ? `Test notification sent to ${payload.deliveredTo} device(s).`
          : "Test notification sent."
      );
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Test notification failed");
    } finally {
      setIsBusy(false);
    }
  };

  const handleDismiss = () => {
    window.sessionStorage.setItem(PUSH_DISMISSED_KEY, "1");
    setDismissed(true);
  };

  if (uiState === "loading" || uiState === "unsupported") {
    return null;
  }

  if (dismissed && (uiState === "subscribed" || uiState === "ready")) {
    return null;
  }

  const description =
    uiState === "not_configured"
      ? "Server push keys are missing. Add VAPID keys to .env.local and restart the dev server."
      : uiState === "denied"
        ? "Notifications are blocked in your browser. Allow them in site settings, then click Enable."
        : uiState === "subscribed"
          ? "You will receive alerts for dealer applications, orders, and Stripe payments."
          : uiState === "ready"
            ? "Enable alerts for new dealer applications, orders, and Stripe payments — even when this tab is closed."
            : "Push setup needs attention.";

  return (
    <div className="mb-4 rounded-2xl border border-brand/25 bg-brand-light/20 px-4 py-4 dark:border-brand/30 dark:bg-brand-light/10 sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-cream">
            {uiState === "subscribed" ? "Desktop notifications enabled" : "Desktop notifications"}
          </p>
          <p className="mt-1 text-sm text-slate-600 dark:text-cream/70">{description}</p>
          {statusMessage && (
            <p className="mt-2 text-sm font-medium text-brand dark:text-brand">{statusMessage}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(uiState === "ready" || uiState === "error" || uiState === "denied") && (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void handleEnable()}
              className={ui.btnPrimary}
            >
              {isBusy ? "Working..." : "Enable notifications"}
            </button>
          )}
          {uiState === "subscribed" && (
            <button type="button" disabled={isBusy} onClick={() => void handleTest()} className={ui.btnSecondary}>
              {isBusy ? "Sending..." : "Send test"}
            </button>
          )}
          <button type="button" onClick={handleDismiss} className={ui.btnSecondary}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
