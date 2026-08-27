export const ADMIN_PERMISSION_KEYS = [
  "can_view_logs",
  "can_restore_logs",
  "can_approve_users",
  "can_ban_users",
  "can_create_users",
  "can_delete_users",
  "can_view_user_tiers",
  "can_change_user_tier",
  "can_add_tiers",
  "can_delete_tiers",
  "can_edit_tiers",
  "can_view_products",
  "can_add_products",
  "can_delete_products",
  "can_toggle_products",
  "can_bulk_upload_products",
  "can_add_finishes",
  "can_delete_finishes",
  "can_toggle_finishes",
  "can_view_orders",
  "can_change_order_status",
  "can_edit_orders",
  "can_send_quickbooks",
  "can_manage_quotes",
  "can_manage_announcements",
  "can_impersonate_users",
  "can_manage_coupons",
  "can_delete_coupons",
  "can_toggle_coupons",
  "can_manage_emails",
  "can_send_bulk_emails",
  "can_manage_dealer_groups",
  "can_manage_shipping_zones",
  "can_approve_tax_exemption",
  "can_view_churn_radar",
  "can_manage_churn_recovery",
] as const;

export type AdminPermissionKey = (typeof ADMIN_PERMISSION_KEYS)[number];

export type AdminPermissions = Record<AdminPermissionKey, boolean> & {
  isSuperAdmin: boolean;
};

export type AdminPermissionsRow = {
  user_id: number;
  is_super_admin: boolean;
} & Record<AdminPermissionKey, boolean>;

export const PERMISSION_FORBIDDEN_MESSAGE =
  "You do not have permission to perform this action";

export const ADMIN_ROUTE_FORBIDDEN_MESSAGE =
  "You do not have permission to access this module";

export const ADMIN_PERMISSION_GROUPS: Array<{
  title: string;
  items: Array<{ key: AdminPermissionKey; label: string; description?: string }>;
}> = [
  {
    title: "Log Management",
    items: [
      { key: "can_view_logs", label: "View audit logs" },
      { key: "can_restore_logs", label: "Undo audit log actions" },
    ],
  },
  {
    title: "User Management",
    items: [
      { key: "can_approve_users", label: "Approve / reinstate members" },
      { key: "can_ban_users", label: "Ban / reject members" },
      {
        key: "can_create_users",
        label: "Add members",
        description: "Create dealer accounts from admin, including incomplete profiles",
      },
      {
        key: "can_delete_users",
        label: "Delete members",
        description: "Soft-delete members. They stay in the system as Deleted users and cannot sign in",
      },
      { key: "can_view_user_tiers", label: "View member tier levels" },
      { key: "can_change_user_tier", label: "Change member tier levels" },
      {
        key: "can_impersonate_users",
        label: "Impersonate dealers (place orders as customer)",
        description: "Sign in as an approved dealer to place phone orders on their behalf",
      },
      {
        key: "can_approve_tax_exemption",
        label: "Approve tax exemption certificates",
        description: "Review Texas resale certificates and approve or reject tax-exempt status",
      },
      {
        key: "can_view_churn_radar",
        label: "View at-risk dealer radar",
        description: "See VIP dealers with login or order inactivity churn signals",
      },
      {
        key: "can_manage_churn_recovery",
        label: "Issue churn recovery coupons",
        description: "Create win-back promo codes for at-risk VIP dealers from the command center",
      },
    ],
  },
  {
    title: "Tier Management",
    items: [
      { key: "can_add_tiers", label: "Add tiers" },
      { key: "can_delete_tiers", label: "Delete tiers" },
      { key: "can_edit_tiers", label: "Edit tier discount multipliers" },
    ],
  },
  {
    title: "Product / Catalog Management",
    items: [
      { key: "can_view_products", label: "View catalog products" },
      { key: "can_add_products", label: "Add / edit products" },
      { key: "can_delete_products", label: "Soft-delete products" },
      { key: "can_toggle_products", label: "Activate / deactivate products" },
      { key: "can_bulk_upload_products", label: "Bulk upload (Excel/CSV)" },
    ],
  },
  {
    title: "Finish Management",
    items: [
      { key: "can_add_finishes", label: "Add / edit finishes" },
      { key: "can_delete_finishes", label: "Soft-delete finishes" },
      { key: "can_toggle_finishes", label: "Activate / deactivate finishes" },
    ],
  },
  {
    title: "Order Management",
    items: [
      { key: "can_view_orders", label: "View orders" },
      { key: "can_change_order_status", label: "Change order status" },
      {
        key: "can_edit_orders",
        label: "Edit order line items",
        description:
          "Modify quantities, remove products, or add cabinet SKUs on pending/processing orders",
      },
      { key: "can_send_quickbooks", label: "Send to QuickBooks" },
    ],
  },
  {
    title: "Quote Management",
    items: [
      {
        key: "can_manage_quotes",
        label: "View / manage dealer quotes",
        description: "Review saved project quote drafts from dealers",
      },
    ],
  },
  {
    title: "Announcement Management",
    items: [
      {
        key: "can_manage_announcements",
        label: "Manage dealer pop-up campaigns",
        description: "Create, edit, and configure dealer pop-up campaigns with targeting and priority rules",
      },
    ],
  },
  {
    title: "Coupons & Email Campaigns",
    items: [
      {
        key: "can_manage_coupons",
        label: "Manage coupons",
        description: "Create promo codes and configure automatic coupon rates",
      },
      {
        key: "can_toggle_coupons",
        label: "Activate / deactivate coupons",
        description: "Disable or re-enable issued promo codes",
      },
      {
        key: "can_delete_coupons",
        label: "Delete coupons",
        description: "Permanently remove unused promo codes",
      },
      {
        key: "can_manage_emails",
        label: "Manage email templates",
        description: "Create, edit, and configure automated email templates",
      },
      {
        key: "can_send_bulk_emails",
        label: "Send bulk emails",
        description: "Send template emails to dealer groups or all customers",
      },
      {
        key: "can_manage_dealer_groups",
        label: "Manage dealer groups",
        description: "Create custom dealer groups for targeted email campaigns",
      },
    ],
  },
  {
    title: "Shipping",
    items: [
      {
        key: "can_manage_shipping_zones",
        label: "Manage shipping zones",
        description: "Configure ZIP-based delivery rates and free-shipping thresholds",
      },
    ],
  },
];

export const USER_DIRECTORY_PERMISSIONS: AdminPermissionKey[] = [
  "can_approve_users",
  "can_ban_users",
  "can_create_users",
  "can_delete_users",
  "can_view_user_tiers",
  "can_change_user_tier",
  "can_approve_tax_exemption",
];

export const ALL_ADMIN_PERMISSIONS = Object.fromEntries(
  ADMIN_PERMISSION_KEYS.map((key) => [key, true])
) as Record<AdminPermissionKey, boolean>;

export function createEmptyAdminPermissions(): AdminPermissions {
  return {
    isSuperAdmin: false,
    ...Object.fromEntries(ADMIN_PERMISSION_KEYS.map((key) => [key, false])),
  } as AdminPermissions;
}

export function mapAdminPermissionsRow(row: AdminPermissionsRow): AdminPermissions {
  const mapped = createEmptyAdminPermissions();
  mapped.isSuperAdmin = row.is_super_admin;

  for (const key of ADMIN_PERMISSION_KEYS) {
    mapped[key] = row[key];
  }

  if (mapped.isSuperAdmin) {
    for (const key of ADMIN_PERMISSION_KEYS) {
      mapped[key] = true;
    }
  }

  return mapped;
}

export function hasAdminPermission(
  permissions: AdminPermissions,
  permission: AdminPermissionKey
) {
  return permissions.isSuperAdmin || permissions[permission];
}

export function hasAnyAdminPermission(
  permissions: AdminPermissions,
  permissionList: AdminPermissionKey[]
) {
  if (permissions.isSuperAdmin) {
    return true;
  }

  return permissionList.some((permission) => permissions[permission]);
}

export function permissionsToUpdatePayload(permissions: AdminPermissions) {
  return Object.fromEntries(
    ADMIN_PERMISSION_KEYS.map((key) => [key, permissions[key]])
  );
}

export function getAdminPermissionLabel(key: AdminPermissionKey) {
  for (const group of ADMIN_PERMISSION_GROUPS) {
    const item = group.items.find((entry) => entry.key === key);

    if (item) {
      return item.label;
    }
  }

  return key.replaceAll("_", " ");
}

export const NAV_PERMISSION_REQUIREMENTS: Record<string, AdminPermissionKey[]> = {
  "/admin/orders": ["can_view_orders"],
  "/admin/orders/dealer-quotes": ["can_view_orders"],
  "/admin/orders/abandoned-carts": ["can_view_orders"],
  "/admin/quotes": ["can_manage_quotes"],
  "/admin/finishes": ["can_add_finishes", "can_delete_finishes", "can_toggle_finishes"],
  "/admin/categories": [
    "can_view_products",
    "can_add_products",
    "can_delete_products",
    "can_bulk_upload_products",
  ],
  "/admin/products/catalog": [
    "can_view_products",
    "can_add_products",
    "can_delete_products",
    "can_toggle_products",
    "can_bulk_upload_products",
  ],
  "/admin/users": USER_DIRECTORY_PERMISSIONS,
  "/admin/users/tax-exemptions": ["can_approve_tax_exemption"],
  "/admin/logs": ["can_view_logs"],
  "/admin/tiers": ["can_add_tiers", "can_delete_tiers", "can_edit_tiers"],
  "/admin/announcement": ["can_manage_announcements"],
  "/admin/settings/emails": ["can_manage_emails"],
  "/admin/settings/recipient-groups": ["can_manage_dealer_groups"],
  "/admin/settings/shipping": ["can_manage_shipping_zones"],
  "/admin/coupons": ["can_manage_coupons", "can_toggle_coupons", "can_delete_coupons"],
  "/admin/campaigns/abandoned-carts": [
    "can_manage_emails",
    "can_manage_coupons",
    "can_toggle_coupons",
    "can_delete_coupons",
    "can_send_bulk_emails",
    "can_manage_dealer_groups",
    "can_manage_shipping_zones",
  ],
  "/admin/campaigns": [
    "can_manage_emails",
    "can_manage_coupons",
    "can_toggle_coupons",
    "can_delete_coupons",
    "can_send_bulk_emails",
    "can_manage_dealer_groups",
    "can_manage_shipping_zones",
  ],
};

export function getAdminRoutePermissionRequirements(
  pathname: string
): AdminPermissionKey[] | null {
  if (pathname === "/admin") {
    return null;
  }

  const sortedPrefixes = Object.keys(NAV_PERMISSION_REQUIREMENTS).sort(
    (left, right) => right.length - left.length
  );

  for (const prefix of sortedPrefixes) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return NAV_PERMISSION_REQUIREMENTS[prefix];
    }
  }

  if (pathname.startsWith("/admin/products")) {
    return NAV_PERMISSION_REQUIREMENTS["/admin/products/catalog"];
  }

  return [];
}

export function canAccessAdminRoute(pathname: string, permissions: AdminPermissions) {
  if (permissions.isSuperAdmin) {
    return true;
  }

  if (pathname === "/admin") {
    return true;
  }

  const required = getAdminRoutePermissionRequirements(pathname);

  if (required === null) {
    return true;
  }

  if (required.length === 0) {
    return false;
  }

  return hasAnyAdminPermission(permissions, required);
}

export function canAccessAdminNavItem(
  href: string,
  permissions: AdminPermissions
) {
  return canAccessAdminRoute(href, permissions);
}
