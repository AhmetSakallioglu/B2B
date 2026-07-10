import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AdminRouteGuard } from "@/components/admin/AdminRouteGuard";
import { getAdminPermissions } from "@/lib/admin-permissions";
import { CUSTOMER_CATALOG_PATH } from "@/lib/route-guard";
import { getSessionUser } from "@/lib/auth";
import { ADMIN_ROOT_METADATA } from "@/lib/site-metadata";

export const metadata = ADMIN_ROOT_METADATA;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login?redirect=/admin");
  }

  if (user.role !== "admin") {
    redirect(CUSTOMER_CATALOG_PATH);
  }

  const permissions = await getAdminPermissions(user.id);

  return <AdminRouteGuard permissions={permissions}>{children}</AdminRouteGuard>;
}
