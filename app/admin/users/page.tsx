"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  AdminAlert,
  AdminBadge,
  AdminButton,
  AdminLink,
} from "@/components/admin/admin-ui";
import { SearchIcon } from "@/components/ui/Icon";
import { AdminPermissionsModal } from "@/components/admin/AdminPermissionsModal";
import { ImpersonateCustomerButton } from "@/components/admin/ImpersonateCustomerButton";
import { refreshAdminNotifications } from "@/components/admin/AdminNotificationsProvider";
import { AdminShell } from "@/components/admin/AdminShell";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { createEmptyAdminPermissions, type AdminPermissions } from "@/types/admin-permissions";
import { ACCOUNT_STATUS_LABELS, getApprovalConfirmDialog, getApprovalSuccessMessage } from "@/lib/user-approval";
import { formatDate } from "@/lib/order-display";
import { ui } from "@/lib/ui-classes";
import type { AdminUserSummary } from "@/types/customer-tier";

const STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending approval" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Banned" },
] as const;

function statusTone(status: AdminUserSummary["accountStatus"]) {
  if (status === "pending") return "brand" as const;
  if (status === "approved") return "success" as const;
  return "danger" as const;
}

export default function AdminUsersPage() {
  const { confirm } = useConfirm();
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    (typeof STATUS_FILTERS)[number]["value"]
  >(() => {
    if (typeof window === "undefined") {
      return "all";
    }

    const status = new URLSearchParams(window.location.search).get("status");

    if (status === "pending" || status === "approved" || status === "rejected") {
      return status;
    }

    return "all";
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [currentPermissions, setCurrentPermissions] = useState<AdminPermissions>(
    createEmptyAdminPermissions()
  );
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [permissionsTarget, setPermissionsTarget] = useState<AdminUserSummary | null>(null);

  const loadUsers = useCallback(async (query: string, status: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();

      if (query.trim()) {
        params.set("q", query.trim());
      }

      if (status !== "all") {
        params.set("status", status);
      }

      const queryString = params.toString();
      const response = await fetch(`/api/admin/users${queryString ? `?${queryString}` : ""}`);

      if (!response.ok) {
        throw new Error("Failed to load users");
      }

      const data = (await response.json()) as { users: AdminUserSummary[] };
      setUsers(data.users);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load users");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useDeferredEffect(() => {
    const loadCurrentAdmin = async () => {
      const response = await fetch("/api/auth/me");

      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as {
        user?: { id: number };
        permissions?: AdminPermissions;
      };
      setCurrentPermissions(data.permissions ?? createEmptyAdminPermissions());
      setCurrentUserId(data.user?.id ?? null);
    };

    void loadCurrentAdmin();
  }, []);

  useDeferredEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadUsers(searchQuery, statusFilter);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [loadUsers, searchQuery, statusFilter]);

  const handleApproval = async (
    member: AdminUserSummary,
    action: "approve" | "reject"
  ) => {
    const confirmed = await confirm(getApprovalConfirmDialog(member.accountStatus, action));

    if (!confirmed) {
      return;
    }

    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/admin/users/${member.id}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update account access");
      }

      setMessage(getApprovalSuccessMessage(member.accountStatus, action));

      if (member.accountStatus === "pending") {
        refreshAdminNotifications();
      }

      await loadUsers(searchQuery, statusFilter);
    } catch (approvalError) {
      setError(
        approvalError instanceof Error ? approvalError.message : "Failed to update account access"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const stats = useMemo(
    () => ({
      total: users.length,
      pending: users.filter((user) => user.accountStatus === "pending").length,
      banned: users.filter((user) => user.accountStatus === "rejected").length,
      admins: users.filter((user) => user.role === "admin").length,
      tiered: users.filter((user) => user.tier).length,
    }),
    [users]
  );

  return (
    <AdminShell
      wide
      title="User Management"
      subtitle="Review new registrations, approve accounts, and manage customer tiers"
    >
      <div className="space-y-6">
        {message && <AdminAlert tone="success">{message}</AdminAlert>}
        {error && <AdminAlert tone="error">{error}</AdminAlert>}

        <div className="flex flex-wrap items-center gap-3">
          {(currentPermissions.isSuperAdmin ||
            currentPermissions.can_approve_tax_exemption) && (
            <Link href="/admin/users/tax-exemptions" className={ui.btnSecondary}>
              Tax exemption reviews
            </Link>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className={`p-5 ${ui.adminCard}`}>
            <p className="text-sm font-medium text-slate-500 dark:text-cream/70">Users shown</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-cream">{stats.total}</p>
          </div>
          <div className={`border-brand/30 bg-brand-light/30 p-5 ${ui.adminCard}`}>
            <p className="text-sm font-medium text-brand">Pending approval</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-brand">{stats.pending}</p>
          </div>
          <div className="rounded-2xl border border-red-200/80 bg-red-50 p-5 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05),0_10px_20px_-12px_rgba(0,0,0,0.05)] dark:border-red-900/40 dark:bg-red-950/20">
            <p className="text-sm font-medium text-slate-500 dark:text-cream/70">Banned</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-red-700 dark:text-red-300">{stats.banned}</p>
          </div>
          <div className={`p-5 ${ui.adminCard}`}>
            <p className="text-sm font-medium text-slate-500 dark:text-cream/70">Admins</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-cream">{stats.admins}</p>
          </div>
          <div className={`p-5 ${ui.adminCard}`}>
            <p className="text-sm font-medium text-slate-500 dark:text-cream/70">Tiered customers</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-brand">{stats.tiered}</p>
          </div>
        </div>

        <section className={`overflow-hidden ${ui.adminCard}`}>
          <div className="border-b border-slate-200/80 bg-slate-50/80 px-5 py-5 dark:border-zinc-700/50 dark:bg-navy-hover/30 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className={ui.heading2}>Search & filter</h2>
                <p className={`mt-1.5 ${ui.bodyMuted}`}>
                  Find users by email, company, or contact name.
                </p>
              </div>
              <label htmlFor="user-search" className="relative block w-full lg:max-w-md">
                <span className="sr-only">Search users</span>
                <SearchIcon
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  id="user-search"
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Email, company, contact name..."
                  className={`${ui.input} pl-11`}
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {STATUS_FILTERS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setStatusFilter(option.value as (typeof STATUS_FILTERS)[number]["value"])
                  }
                  className={
                    statusFilter === option.value ? ui.catalogSubPillActive : ui.catalogSubPillIdle
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {isLoading ? (
          <p className={ui.bodyMuted}>Loading users...</p>
        ) : users.length === 0 ? (
          <div className={`px-6 py-16 text-center ${ui.emptyState}`}>
            <p className="text-slate-600 dark:text-cream/80">No users match your filters.</p>
          </div>
        ) : (
          <div className={`overflow-hidden ${ui.adminCard}`}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className={ui.tableHead}>
                  <tr>
                    <th className={ui.tableHeadCell}>User</th>
                    <th className={ui.tableHeadCell}>Company</th>
                    <th className={ui.tableHeadCell}>Status</th>
                    <th className={ui.tableHeadCell}>Role</th>
                    <th className={ui.tableHeadCell}>Tier</th>
                    <th className={ui.tableHeadCell}>Joined</th>
                    <th className={ui.tableHeadCell}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className={ui.tableRow}>
                      <td className={ui.tableCell}>
                        <p className="font-semibold text-slate-900 dark:text-cream">{user.email}</p>
                        {user.contactName && (
                          <p className="mt-1 text-xs text-slate-500 dark:text-cream/60">
                            {user.contactName}
                          </p>
                        )}
                      </td>
                      <td className={`${ui.tableCell} text-slate-600 dark:text-cream/75`}>
                        {user.companyName || "—"}
                      </td>
                      <td className={ui.tableCell}>
                        <AdminBadge tone={statusTone(user.accountStatus)}>
                          {ACCOUNT_STATUS_LABELS[user.accountStatus]}
                        </AdminBadge>
                      </td>
                      <td className={ui.tableCell}>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${
                            user.role === "admin"
                              ? "border border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800/50 dark:bg-violet-950/40 dark:text-violet-300"
                              : "border border-slate-200 bg-slate-50 text-slate-700 dark:border-zinc-700/50 dark:text-cream/90"
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className={`${ui.tableCell} text-slate-600 dark:text-cream/75`}>
                        {user.tier ? (
                          <span>
                            {user.tier.name}{" "}
                            <span className="text-brand">({user.tier.discountPercent}% off)</span>
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className={`${ui.tableCell} text-slate-500 dark:text-cream/75`}>
                        {formatDate(user.createdAt)}
                      </td>
                      <td className={ui.tableCell}>
                        <div className="flex flex-wrap gap-2">
                          {user.role === "customer" && user.accountStatus !== "approved" && (
                            <AdminButton
                              type="button"
                              variant="primary"
                              disabled={isSaving}
                              onClick={() => handleApproval(user, "approve")}
                            >
                              {user.accountStatus === "rejected" ? "Reinstate" : "Approve"}
                            </AdminButton>
                          )}
                          {user.role === "customer" && user.accountStatus !== "rejected" && (
                            <AdminButton
                              type="button"
                              variant="danger"
                              disabled={isSaving}
                              onClick={() => handleApproval(user, "reject")}
                            >
                              {user.accountStatus === "approved" ? "Ban" : "Reject"}
                            </AdminButton>
                          )}
                          {user.role === "admin" &&
                            currentPermissions.isSuperAdmin &&
                            currentUserId !== user.id && (
                              <AdminButton
                                type="button"
                                variant="secondary"
                                onClick={() => setPermissionsTarget(user)}
                              >
                                Permissions
                              </AdminButton>
                            )}
                          {user.role === "customer" &&
                            user.accountStatus === "approved" &&
                            (currentPermissions.isSuperAdmin ||
                              currentPermissions.can_impersonate_users) && (
                              <ImpersonateCustomerButton userId={user.id} disabled={isSaving} compact />
                            )}
                          <AdminLink href={`/admin/users/${user.id}`}>Edit</AdminLink>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {stats.pending > 0 && statusFilter !== "pending" && (
          <p className={`text-sm ${ui.bodyMuted}`}>
            {stats.pending} account{stats.pending === 1 ? "" : "s"} in this view still need approval.{" "}
            <Link href="#" onClick={(event) => { event.preventDefault(); setStatusFilter("pending"); }} className="font-medium text-brand hover:underline">
              Show pending only
            </Link>
          </p>
        )}
      </div>

      {permissionsTarget && (
        <AdminPermissionsModal
          open
          userId={permissionsTarget.id}
          adminEmail={permissionsTarget.email}
          onClose={() => setPermissionsTarget(null)}
        />
      )}
    </AdminShell>
  );
}
