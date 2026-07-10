import type { UserRole } from "@/types/auth";

export type AccountStatus = "pending" | "approved" | "rejected";

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  pending: "Pending approval",
  approved: "Approved",
  rejected: "Banned",
};

export const LOGIN_STATUS_MESSAGES: Record<"pending" | "rejected", string> = {
  pending:
    "Your account is pending approval. You will be able to sign in once an administrator activates your account.",
  rejected:
    "Your account has been suspended. Please contact support if you believe this is an error.",
};

export function getApprovalConfirmMessage(
  currentStatus: AccountStatus,
  action: "approve" | "reject"
) {
  if (action === "approve") {
    return currentStatus === "rejected"
      ? "Reinstate this member? They will be able to sign in and use the site again."
      : "Approve this account? The member will be able to sign in.";
  }

  return currentStatus === "approved"
    ? "Ban this member? They will lose access immediately and will not be able to sign in."
    : "Reject this registration? The user will not be able to sign in.";
}

export function getApprovalConfirmDialog(
  currentStatus: AccountStatus,
  action: "approve" | "reject"
) {
  if (action === "approve") {
    return {
      title: currentStatus === "rejected" ? "Reinstate member?" : "Approve account?",
      description: getApprovalConfirmMessage(currentStatus, action),
      confirmLabel: currentStatus === "rejected" ? "Reinstate" : "Approve",
      cancelLabel: "Cancel",
      tone: "default" as const,
    };
  }

  return {
    title: currentStatus === "approved" ? "Ban member?" : "Reject registration?",
    description: getApprovalConfirmMessage(currentStatus, action),
    confirmLabel: currentStatus === "approved" ? "Ban member" : "Reject",
    cancelLabel: "Keep account",
    tone: "danger" as const,
  };
}

export function getApprovalSuccessMessage(
  currentStatus: AccountStatus,
  action: "approve" | "reject"
) {
  if (action === "approve") {
    return currentStatus === "rejected" ? "Member reinstated." : "Account approved.";
  }

  return currentStatus === "approved" ? "Member banned." : "Registration rejected.";
}

export const REGISTRATION_PENDING_MESSAGE =
  "Your account was created successfully. An administrator must approve your registration before you can sign in.";

export const REGISTRATION_TAX_CERTIFICATE_PENDING_NOTE =
  "If you uploaded a Texas resale certificate, it will be reviewed separately after your account is approved. Sales tax will apply until tax exemption is approved.";

export function isAccountUsable(role: UserRole, accountStatus: AccountStatus) {
  if (role === "admin") {
    return true;
  }

  return accountStatus === "approved";
}

export function parseAccountStatus(value: unknown): AccountStatus | null {
  if (value === "pending" || value === "approved" || value === "rejected") {
    return value;
  }

  return null;
}

export function parseApprovalAction(body: unknown) {
  if (!body || typeof body !== "object") {
    return null;
  }

  const action = (body as Record<string, unknown>).action;

  if (action === "approve" || action === "reject") {
    return action;
  }

  return null;
}
