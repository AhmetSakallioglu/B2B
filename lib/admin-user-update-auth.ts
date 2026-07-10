import { NextResponse } from "next/server";
import {
  hasAdminPermission,
  hasAnyAdminPermission,
  PERMISSION_FORBIDDEN_MESSAGE,
  type AdminPermissions,
} from "@/types/admin-permissions";
import type { UpdateAdminUserBody } from "@/lib/admin-users";

type ExistingUser = {
  id: number;
  role: "customer" | "admin";
  account_status: "pending" | "approved" | "rejected";
  tier_id: number | null;
  group_tag: string;
  company_name: string | null;
  contact_name: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
};

function isApprovalTransition(
  from: ExistingUser["account_status"],
  to: ExistingUser["account_status"]
) {
  return to === "approved" && from !== "approved";
}

function isBanTransition(
  from: ExistingUser["account_status"],
  to: ExistingUser["account_status"]
) {
  return to === "rejected" && from !== "rejected";
}

function hasProfileFieldChanges(body: UpdateAdminUserBody, existing: ExistingUser) {
  const compare = (next: string | undefined, current: string | null) =>
    next !== undefined && next !== (current ?? "");

  return (
    compare(body.companyName, existing.company_name) ||
    compare(body.contactName, existing.contact_name) ||
    compare(body.phone, existing.phone) ||
    compare(body.addressLine1, existing.address_line1) ||
    compare(body.addressLine2, existing.address_line2) ||
    compare(body.city, existing.city) ||
    compare(body.state, existing.state) ||
    compare(body.postalCode, existing.postal_code) ||
    compare(body.country, existing.country)
  );
}

export function validateAdminUserUpdateAuthorization(
  permissions: AdminPermissions,
  body: UpdateAdminUserBody,
  existing: ExistingUser
) {
  const nextRole = body.role ?? existing.role;
  const nextAccountStatus = body.accountStatus ?? existing.account_status;
  const nextTierId =
    body.tierId !== undefined ? body.tierId : existing.tier_id;

  const roleChanged = nextRole !== existing.role;
  const accountStatusChanged = nextAccountStatus !== existing.account_status;
  const tierChanged = nextTierId !== existing.tier_id;
  const profileChanged = hasProfileFieldChanges(body, existing);
  const groupTagChanged =
    nextRole === "customer" &&
    body.groupTag !== undefined &&
    body.groupTag !== existing.group_tag;

  if (
    !roleChanged &&
    !accountStatusChanged &&
    !tierChanged &&
    !profileChanged &&
    !groupTagChanged
  ) {
    return null;
  }

  if (roleChanged) {
    if (!permissions.isSuperAdmin) {
      return NextResponse.json({ error: PERMISSION_FORBIDDEN_MESSAGE }, { status: 403 });
    }
  }

  if (accountStatusChanged) {
    if (
      isApprovalTransition(existing.account_status, nextAccountStatus) &&
      !hasAdminPermission(permissions, "can_approve_users")
    ) {
      return NextResponse.json({ error: PERMISSION_FORBIDDEN_MESSAGE }, { status: 403 });
    }

    if (
      isBanTransition(existing.account_status, nextAccountStatus) &&
      !hasAdminPermission(permissions, "can_ban_users")
    ) {
      return NextResponse.json({ error: PERMISSION_FORBIDDEN_MESSAGE }, { status: 403 });
    }

    if (
      !isApprovalTransition(existing.account_status, nextAccountStatus) &&
      !isBanTransition(existing.account_status, nextAccountStatus)
    ) {
      return NextResponse.json(
        { error: "This account status change is not allowed" },
        { status: 400 }
      );
    }
  }

  if (tierChanged && !hasAdminPermission(permissions, "can_change_user_tier")) {
    return NextResponse.json({ error: PERMISSION_FORBIDDEN_MESSAGE }, { status: 403 });
  }

  if (
    profileChanged &&
    !hasAnyAdminPermission(permissions, ["can_approve_users", "can_ban_users"])
  ) {
    return NextResponse.json({ error: PERMISSION_FORBIDDEN_MESSAGE }, { status: 403 });
  }

  if (groupTagChanged && !hasAdminPermission(permissions, "can_approve_users")) {
    return NextResponse.json({ error: PERMISSION_FORBIDDEN_MESSAGE }, { status: 403 });
  }

  return null;
}
