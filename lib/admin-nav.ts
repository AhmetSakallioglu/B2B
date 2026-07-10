import {
  canAccessAdminNavItem,
  hasAnyAdminPermission,
  type AdminPermissionKey,
  type AdminPermissions,
} from "@/types/admin-permissions";

export type AdminMainNavId =
  | "dashboard"
  | "orders"
  | "campaigns"
  | "quotes"
  | "finishes"
  | "categories"
  | "catalog"
  | "users"
  | "logs"
  | "tiers"
  | "announcement";

export type AdminOrdersSubNavTab = "list" | "customers" | "dealer-quotes" | "abandoned-carts";

export type AdminCampaignsSubNavTab = "abandoned" | "coupons" | "emails" | "groups" | "shipping";

export const CAMPAIGN_ADMIN_PATH_PREFIXES = [
  "/admin/campaigns",
  "/admin/coupons",
  "/admin/settings/emails",
  "/admin/settings/recipient-groups",
  "/admin/settings/shipping",
] as const;

/** Orders analytics path for cart abandonment heat map. */
export const LEGACY_ABANDONED_CARTS_PATH = "/admin/orders/abandoned-carts";

export const CAMPAIGN_HOME_PATH = "/admin/campaigns/abandoned-carts";

export const CAMPAIGN_NAV_PERMISSIONS: AdminPermissionKey[] = [
  "can_manage_emails",
  "can_manage_coupons",
  "can_toggle_coupons",
  "can_delete_coupons",
  "can_send_bulk_emails",
  "can_manage_dealer_groups",
  "can_manage_shipping_zones",
];

export const ORDER_SUB_TABS: Array<{ id: AdminOrdersSubNavTab; href: string; label: string }> = [
  { id: "list", href: "/admin/orders?tab=list", label: "Order list" },
  { id: "customers", href: "/admin/orders?tab=customers", label: "Customer summary" },
  { id: "dealer-quotes", href: "/admin/orders/dealer-quotes", label: "Dealer client quotes" },
  { id: "abandoned-carts", href: "/admin/orders/abandoned-carts", label: "Abandoned carts" },
];

export const CAMPAIGN_SUB_TABS: Array<{ id: AdminCampaignsSubNavTab; href: string; label: string }> =
  [
    { id: "abandoned", href: CAMPAIGN_HOME_PATH, label: "Abandoned carts" },
    { id: "coupons", href: "/admin/coupons", label: "Coupons" },
    { id: "emails", href: "/admin/settings/emails", label: "Email templates" },
    { id: "groups", href: "/admin/settings/recipient-groups", label: "Dealer groups" },
    { id: "shipping", href: "/admin/settings/shipping", label: "Shipping zones" },
  ];

export type AdminMainNavItem = {
  id: AdminMainNavId;
  href: string;
  label: string;
  badge?: "pendingUsers" | "pendingOrders" | "pendingTotal";
};

export const ADMIN_MAIN_NAV_ITEMS: AdminMainNavItem[] = [
  { id: "dashboard", href: "/admin", label: "Dashboard", badge: "pendingTotal" },
  { id: "orders", href: "/admin/orders", label: "Orders", badge: "pendingOrders" },
  { id: "campaigns", href: CAMPAIGN_HOME_PATH, label: "Campaigns" },
  { id: "quotes", href: "/admin/quotes", label: "Quotes" },
  { id: "finishes", href: "/admin/finishes", label: "Finishes" },
  { id: "categories", href: "/admin/categories", label: "Categories" },
  { id: "catalog", href: "/admin/products/catalog", label: "Catalog" },
  { id: "users", href: "/admin/users", label: "Users", badge: "pendingUsers" },
  { id: "logs", href: "/admin/logs", label: "Audit Log" },
  { id: "tiers", href: "/admin/tiers", label: "Tiers" },
  { id: "announcement", href: "/admin/announcement", label: "Announcement" },
];

export function isCampaignAdminPath(pathname: string) {
  if (pathname === LEGACY_ABANDONED_CARTS_PATH) {
    return true;
  }

  return CAMPAIGN_ADMIN_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function isOrdersAdminPath(pathname: string) {
  if (pathname === LEGACY_ABANDONED_CARTS_PATH) {
    return false;
  }

  return pathname === "/admin/orders" || pathname.startsWith("/admin/orders/");
}

export function resolveActiveAdminMainNavId(pathname: string): AdminMainNavId {
  if (pathname === "/admin") {
    return "dashboard";
  }

  if (isCampaignAdminPath(pathname)) {
    return "campaigns";
  }

  if (isOrdersAdminPath(pathname)) {
    return "orders";
  }

  if (pathname.startsWith("/admin/quotes")) {
    return "quotes";
  }

  if (pathname.startsWith("/admin/finishes")) {
    return "finishes";
  }

  if (pathname.startsWith("/admin/categories")) {
    return "categories";
  }

  if (pathname.startsWith("/admin/products")) {
    return "catalog";
  }

  if (pathname.startsWith("/admin/users")) {
    return "users";
  }

  if (pathname.startsWith("/admin/logs")) {
    return "logs";
  }

  if (pathname.startsWith("/admin/tiers")) {
    return "tiers";
  }

  if (pathname.startsWith("/admin/announcement")) {
    return "announcement";
  }

  return "dashboard";
}

export function resolveActiveCampaignSubNavTab(pathname: string): AdminCampaignsSubNavTab {
  if (pathname.startsWith("/admin/coupons")) {
    return "coupons";
  }

  if (pathname.startsWith("/admin/settings/emails")) {
    return "emails";
  }

  if (pathname.startsWith("/admin/settings/recipient-groups")) {
    return "groups";
  }

  if (pathname.startsWith("/admin/settings/shipping")) {
    return "shipping";
  }

  return "abandoned";
}

export function canSeeCampaignsNav(permissions: AdminPermissions) {
  return hasAnyAdminPermission(permissions, CAMPAIGN_NAV_PERMISSIONS);
}

export function isAdminMainNavItemVisible(item: AdminMainNavItem, permissions: AdminPermissions) {
  if (item.id === "campaigns") {
    return canSeeCampaignsNav(permissions);
  }

  if (item.id === "dashboard") {
    return true;
  }

  return canAccessAdminNavItem(item.href, permissions);
}
