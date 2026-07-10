"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { AdminButton } from "@/components/admin/admin-ui";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ShieldIcon } from "@/components/ui/Icon";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { ui } from "@/lib/ui-classes";
import {
  ADMIN_PERMISSION_GROUPS,
  ADMIN_PERMISSION_KEYS,
  createEmptyAdminPermissions,
  permissionsToUpdatePayload,
  type AdminPermissionKey,
  type AdminPermissions,
} from "@/types/admin-permissions";

type AdminPermissionsModalProps = {
  open: boolean;
  adminEmail: string;
  userId: number;
  onClose: () => void;
  onSaved?: () => void;
};

type PermissionGroup = (typeof ADMIN_PERMISSION_GROUPS)[number];

function countEnabledInGroup(permissions: AdminPermissions, group: PermissionGroup) {
  return group.items.filter((item) => permissions[item.key]).length;
}

export function AdminPermissionsModal({
  open,
  adminEmail,
  userId,
  onClose,
  onSaved,
}: AdminPermissionsModalProps) {
  const titleId = useId();
  const [permissions, setPermissions] = useState<AdminPermissions>(createEmptyAdminPermissions());
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const loadPermissions = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/admin/permissions/${userId}`);

        if (!response.ok) {
          throw new Error("Failed to load permissions");
        }

        const data = (await response.json()) as { permissions: AdminPermissions };
        setPermissions(data.permissions);
        setIsSuperAdmin(data.permissions.isSuperAdmin);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load permissions");
      } finally {
        setIsLoading(false);
      }
    };

    void loadPermissions();
  }, [open, userId]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving) {
        onClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isSaving, onClose, open]);

  const enabledCount = useMemo(
    () => ADMIN_PERMISSION_KEYS.filter((key) => permissions[key]).length,
    [permissions]
  );

  if (!open) {
    return null;
  }

  const setGroupPermissions = (group: PermissionGroup, enabled: boolean) => {
    setPermissions((current) => {
      const next = { ...current };
      for (const item of group.items) {
        next[item.key] = enabled;
      }
      return next;
    });
  };

  const setPermission = (key: AdminPermissionKey, enabled: boolean) => {
    setPermissions((current) => ({ ...current, [key]: enabled }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/permissions/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(permissionsToUpdatePayload(permissions)),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save permissions");
      }

      onSaved?.();
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save permissions");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden shadow-2xl ${ui.adminCard}`}
      >
        <header className="border-b border-slate-200/80 px-5 py-4 dark:border-zinc-700/50 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-brand/20 bg-brand-light/40 text-brand">
                  <ShieldIcon size={18} />
                </span>
                <div>
                  <h2 id={titleId} className={ui.heading3}>
                    Admin permissions
                  </h2>
                  <p className={`mt-0.5 truncate ${ui.bodyMuted}`}>{adminEmail}</p>
                </div>
              </div>
              {!isSuperAdmin && !isLoading && (
                <p className={`mt-3 text-xs ${ui.bodyMuted}`}>
                  {enabledCount} of {ADMIN_PERMISSION_KEYS.length} permissions enabled
                </p>
              )}
            </div>
            <AdminButton type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
              Close
            </AdminButton>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {isSuperAdmin ? (
            <div className={`rounded-xl border border-brand/25 bg-brand-light/35 px-4 py-4 ${ui.bodyMuted}`}>
              <p className="font-semibold text-slate-900 dark:text-cream">Super Admin account</p>
              <p className="mt-1 text-sm">
                This account has full access. Permissions cannot be changed here.
              </p>
            </div>
          ) : isLoading ? (
            <div className="flex min-h-[240px] flex-col items-center justify-center gap-3">
              <LoadingSpinner size="lg" />
              <p className={ui.bodyMuted}>Loading permissions...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {ADMIN_PERMISSION_GROUPS.map((group) => {
                const groupEnabled = countEnabledInGroup(permissions, group);
                const allEnabled = groupEnabled === group.items.length;
                const noneEnabled = groupEnabled === 0;

                return (
                  <section
                    key={group.title}
                    className="overflow-hidden rounded-xl border border-slate-200/70 dark:border-zinc-700/50"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-zinc-700/50 dark:bg-navy-hover/40">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-cream">
                          {group.title}
                        </h3>
                        <p className={`mt-0.5 text-xs ${ui.bodyMuted}`}>
                          {groupEnabled} of {group.items.length} enabled
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={allEnabled}
                          onClick={() => setGroupPermissions(group, true)}
                          className={`${ui.btnGhost} px-2.5 py-1.5 text-xs disabled:opacity-40`}
                        >
                          Enable all
                        </button>
                        <button
                          type="button"
                          disabled={noneEnabled}
                          onClick={() => setGroupPermissions(group, false)}
                          className={`${ui.btnGhost} px-2.5 py-1.5 text-xs disabled:opacity-40`}
                        >
                          Clear all
                        </button>
                      </div>
                    </div>

                    <ul className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                      {group.items.map((item) => (
                        <li
                          key={item.key}
                          className="flex items-start justify-between gap-4 px-4 py-3 transition hover:bg-slate-50/60 dark:hover:bg-navy-hover/30"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-900 dark:text-cream">
                              {item.label}
                            </p>
                            {item.description && (
                              <p className={`mt-0.5 text-xs ${ui.bodyMuted}`}>{item.description}</p>
                            )}
                          </div>
                          <ToggleSwitch
                            checked={permissions[item.key]}
                            label={item.label}
                            labelHidden
                            onChange={(checked) => setPermission(item.key, checked)}
                          />
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </p>
          )}
        </div>

        {!isSuperAdmin && !isLoading && (
          <footer
            className={`flex flex-wrap justify-end gap-2 border-t border-slate-200/80 px-5 py-4 dark:border-zinc-700/50 sm:px-6 ${ui.adminActionBar}`}
          >
            <AdminButton type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
              Cancel
            </AdminButton>
            <AdminButton type="button" variant="primary" disabled={isSaving} onClick={handleSave}>
              {isSaving ? (
                <>
                  <LoadingSpinner size="sm" variant="light" />
                  Saving...
                </>
              ) : (
                "Save permissions"
              )}
            </AdminButton>
          </footer>
        )}
      </div>
    </div>
  );
}
