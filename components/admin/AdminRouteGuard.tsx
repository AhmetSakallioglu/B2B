"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ui } from "@/lib/ui-classes";
import {
  ADMIN_ROUTE_FORBIDDEN_MESSAGE,
  canAccessAdminRoute,
  type AdminPermissions,
} from "@/types/admin-permissions";

type AdminRouteGuardProps = {
  permissions: AdminPermissions;
  children: ReactNode;
};

export function AdminRouteGuard({ permissions, children }: AdminRouteGuardProps) {
  const pathname = usePathname();

  if (canAccessAdminRoute(pathname, permissions)) {
    return children;
  }

  return (
    <div className={`flex min-h-full items-center justify-center px-4 py-16 ${ui.adminPageBg}`}>
      <div className={`w-full max-w-lg p-8 text-center ${ui.adminCard}`}>
        <p className={ui.eyebrow}>403 Forbidden</p>
        <h1 className={`mt-3 ${ui.heading1}`}>Access denied</h1>
        <p className={`mt-4 ${ui.bodyMuted}`}>{ADMIN_ROUTE_FORBIDDEN_MESSAGE}</p>
        <Link href="/admin" className={`mt-8 inline-flex ${ui.btnPrimary}`}>
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
