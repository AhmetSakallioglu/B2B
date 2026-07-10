"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import type { AdminNotificationCounts } from "@/lib/admin-notifications";

type AdminNotificationsContextValue = {
  counts: AdminNotificationCounts;
  isLoading: boolean;
  refresh: () => Promise<void>;
  adjustCounts: (delta: Partial<AdminNotificationCounts>) => void;
};

const EMPTY_COUNTS: AdminNotificationCounts = {
  pendingUsers: 0,
  pendingOrders: 0,
};

const AdminNotificationsContext = createContext<AdminNotificationsContextValue | null>(
  null
);

export function AdminNotificationsBoundary({ children }: { children: ReactNode }) {
  const existing = useContext(AdminNotificationsContext);

  if (existing) {
    return children;
  }

  return <AdminNotificationsProvider>{children}</AdminNotificationsProvider>;
}

export function AdminNotificationsProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [counts, setCounts] = useState<AdminNotificationCounts>(EMPTY_COUNTS);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/notifications/counts");

      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as AdminNotificationCounts;
      setCounts(data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const adjustCounts = useCallback((delta: Partial<AdminNotificationCounts>) => {
    setCounts((current) => ({
      pendingUsers: Math.max(0, current.pendingUsers + (delta.pendingUsers ?? 0)),
      pendingOrders: Math.max(0, current.pendingOrders + (delta.pendingOrders ?? 0)),
    }));
  }, []);

  useEffect(() => {
    void refresh();
  }, [pathname, refresh]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refresh();
    }, 60_000);

    return () => window.clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    const handleRefresh = () => {
      void refresh();
    };

    window.addEventListener("admin-notifications-refresh", handleRefresh);
    return () => window.removeEventListener("admin-notifications-refresh", handleRefresh);
  }, [refresh]);

  const value = useMemo(
    () => ({
      counts,
      isLoading,
      refresh,
      adjustCounts,
    }),
    [adjustCounts, counts, isLoading, refresh]
  );

  return (
    <AdminNotificationsContext.Provider value={value}>
      {children}
    </AdminNotificationsContext.Provider>
  );
}

export function useAdminNotifications() {
  const context = useContext(AdminNotificationsContext);

  if (!context) {
    throw new Error("useAdminNotifications must be used within AdminNotificationsProvider");
  }

  return context;
}

export function refreshAdminNotifications() {
  window.dispatchEvent(new CustomEvent("admin-notifications-refresh"));
}
