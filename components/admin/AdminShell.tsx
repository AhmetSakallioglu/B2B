"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLogoutConfirm } from "@/components/auth/LogoutConfirmProvider";
import {
  ClipboardListIcon,
  GridIcon,
  LayersIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MailIcon,
  PaletteIcon,
  SettingsIcon,
  StoreIcon,
  TagIcon,
  UsersIcon,
} from "@/components/ui/Icon";
import { IconLabel } from "@/components/ui/IconLabel";
import { AdminNavBadge } from "@/components/admin/AdminNavBadge";
import { AdminWebPushRegistration } from "@/components/admin/AdminWebPushRegistration";
import {
  AdminNotificationsBoundary,
  useAdminNotifications,
} from "@/components/admin/AdminNotificationsProvider";
import { LoadingState } from "@/components/ui/LoadingState";
import {
  ADMIN_MAIN_NAV_ITEMS,
  isAdminMainNavItemVisible,
  resolveActiveAdminMainNavId,
  type AdminMainNavId,
} from "@/lib/admin-nav";
import {
  createEmptyAdminPermissions,
  type AdminPermissions,
} from "@/types/admin-permissions";
import { CUSTOMER_CATALOG_PATH } from "@/lib/route-guard";
import { ui } from "@/lib/ui-classes";
import type { SessionUser } from "@/types/auth";

type AdminShellProps = {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  wide?: boolean;
};

const NAV_ICONS: Record<AdminMainNavId, ReactNode> = {
  dashboard: <LayoutDashboardIcon size={15} />,
  orders: <ClipboardListIcon size={15} />,
  campaigns: <MailIcon size={15} />,
  quotes: <TagIcon size={15} />,
  finishes: <PaletteIcon size={15} />,
  categories: <TagIcon size={15} />,
  catalog: <GridIcon size={15} />,
  users: <UsersIcon size={15} />,
  logs: <ClipboardListIcon size={15} />,
  tiers: <LayersIcon size={15} />,
  announcement: <SettingsIcon size={15} />,
};

export function AdminShell({ children, title, subtitle, wide = false }: AdminShellProps) {
  return (
    <AdminNotificationsBoundary>
      <AdminShellFrame title={title} subtitle={subtitle} wide={wide}>
        {children}
      </AdminShellFrame>
    </AdminNotificationsBoundary>
  );
}

function AdminShellFrame({ children, title, subtitle, wide = false }: AdminShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { requestLogout } = useLogoutConfirm();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [permissions, setPermissions] = useState<AdminPermissions>(createEmptyAdminPermissions());
  const [authChecked, setAuthChecked] = useState(false);
  const { counts } = useAdminNotifications();

  const activeNavId = resolveActiveAdminMainNavId(pathname);

  const verifyAdmin = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me");

      if (response.status === 401) {
        router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
        return;
      }

      const data = (await response.json()) as {
        user: SessionUser;
        permissions?: AdminPermissions | null;
      };
      setUser(data.user);
      setPermissions(data.permissions ?? createEmptyAdminPermissions());

      if (data.user.role !== "admin") {
        router.replace(CUSTOMER_CATALOG_PATH);
      }
    } finally {
      setAuthChecked(true);
    }
  }, [pathname, router]);

  useEffect(() => {
    verifyAdmin();
  }, [verifyAdmin]);

  const visibleNavItems = useMemo(
    () => ADMIN_MAIN_NAV_ITEMS.filter((item) => isAdminMainNavItemVisible(item, permissions)),
    [permissions]
  );

  const handleLogout = async () => {
    const loggedOut = await requestLogout();
    if (!loggedOut) return;

    router.push("/login");
    router.refresh();
  };

  if (!authChecked) {
    return <LoadingState fullScreen label="Loading admin panel..." spinnerSize="lg" />;
  }

  return (
    <div className={ui.adminPageBg}>
      <header className={ui.adminHeaderBar}>
        <div className={`${ui.pageContainer} py-4`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className={ui.eyebrow}>
                Admin Panel
                {permissions.isSuperAdmin && (
                  <span className="ml-2 rounded-full border border-brand/25 bg-brand-light px-2 py-0.5 text-[10px] text-brand">
                    Super Admin
                  </span>
                )}
              </p>
              <h1 className={`mt-2 ${ui.heading1}`}>{title}</h1>
              {(subtitle || user) && (
                <p className={`mt-1.5 ${ui.bodyMuted}`}>
                  {subtitle ?? `Signed in as ${user?.email}`}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Link href="/" className={ui.btnSecondary}>
                <IconLabel icon={<StoreIcon size={15} />}>Catalog</IconLabel>
              </Link>
              <button type="button" onClick={handleLogout} className={ui.btnPrimary}>
                <IconLabel icon={<LogOutIcon size={15} />}>Logout</IconLabel>
              </button>
            </div>
          </div>

          <nav className="mt-6 flex flex-wrap gap-2" aria-label="Admin modules">
            {visibleNavItems.map((item) => {
              const isActive = activeNavId === item.id;
              const badgeCount =
                item.badge === "pendingUsers"
                  ? counts.pendingUsers
                  : item.badge === "pendingOrders"
                    ? counts.pendingOrders
                    : item.badge === "pendingTotal"
                      ? counts.pendingUsers + counts.pendingOrders
                      : 0;

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={isActive ? ui.btnNavActive : ui.btnNavIdle}
                  aria-current={isActive ? "page" : undefined}
                >
                  <IconLabel icon={NAV_ICONS[item.id]}>
                    <span className="inline-flex items-center">
                      {item.label}
                      {item.badge && (
                        <AdminNavBadge
                          count={badgeCount}
                          active={isActive}
                          label={
                            item.badge === "pendingUsers"
                              ? "pending user approvals"
                              : item.badge === "pendingOrders"
                                ? "pending orders"
                                : "pending admin tasks"
                          }
                        />
                      )}
                    </span>
                  </IconLabel>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className={`${ui.pageContainer} py-8 ${wide ? "" : "max-w-6xl"}`}>
        <AdminWebPushRegistration />
        {children}
      </main>
    </div>
  );
}
