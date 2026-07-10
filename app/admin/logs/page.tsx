"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AdminBadge,
  AdminButton,
  AdminEmptyState,
  AdminListCard,
  AdminListStack,
  AdminPanel,
} from "@/components/admin/admin-ui";
import { AdminShell } from "@/components/admin/AdminShell";
import { LoadingState } from "@/components/ui/LoadingState";
import { Toast } from "@/components/ui/Toast";
import { ui } from "@/lib/ui-classes";
import type { AuditLogEntry } from "@/types/audit-log";

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; description?: string; variant?: "success" | "error" } | null>(null);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/audit-logs");

      if (!response.ok) {
        throw new Error("Failed to load audit logs");
      }

      const data = (await response.json()) as { logs: AuditLogEntry[] };
      setLogs(data.logs);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load audit logs");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const handleRestore = async (log: AuditLogEntry) => {
    setRestoringId(log.id);
    setError(null);

    try {
      const response = await fetch(`/api/admin/audit-logs/${log.id}/restore`, {
        method: "POST",
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to restore change");
      }

      setToast({
        message: "Change restored",
        description: log.summary,
        variant: "success",
      });
      await loadLogs();
    } catch (restoreError) {
      const message =
        restoreError instanceof Error ? restoreError.message : "Failed to restore change";
      setError(message);
      setToast({
        message: "Restore failed",
        description: message,
        variant: "error",
      });
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <AdminShell
      wide
      title="Audit Log"
      subtitle="Track catalog changes and restore recent actions when needed"
    >
      <AdminPanel>
        <p className={`mb-4 text-sm ${ui.bodyMuted}`}>
          Audit logs are automatically cleared after 30 days for database optimization and security.
        </p>

        {error && (
          <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </p>
        )}

        {isLoading ? (
          <LoadingState label="Loading audit history..." minHeight="min-h-[240px]" />
        ) : logs.length === 0 ? (
          <AdminEmptyState>No audit entries yet.</AdminEmptyState>
        ) : (
          <AdminListStack>
            {logs.map((log) => (
              <AdminListCard key={log.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <AdminBadge tone={log.action === "SOFT_DELETE" ? "danger" : log.action === "RESTORE" ? "brand" : "neutral"}>
                        {log.action.replace("_", " ")}
                      </AdminBadge>
                      <span className="text-xs text-muted dark:text-cream/60">
                        {new Intl.DateTimeFormat("en-US", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(log.createdAt))}
                      </span>
                      {log.restoredAt && (
                        <AdminBadge tone="success">Restored</AdminBadge>
                      )}
                    </div>
                    <p className={`mt-2 text-sm leading-relaxed text-slate-800 dark:text-cream`}>
                      {log.summary}
                    </p>
                    <p className={`mt-1 text-xs ${ui.bodyMuted}`}>
                      {log.tableName} #{log.recordId}
                      {log.userEmail ? ` · ${log.userEmail}` : ""}
                    </p>
                  </div>

                  {log.canRestore && (
                    <AdminButton
                      type="button"
                      variant="secondary"
                      disabled={restoringId === log.id}
                      onClick={() => void handleRestore(log)}
                    >
                      Undo
                    </AdminButton>
                  )}
                </div>
              </AdminListCard>
            ))}
          </AdminListStack>
        )}
      </AdminPanel>

      {toast && (
        <Toast
          message={toast.message}
          description={toast.description}
          variant={toast.variant ?? "success"}
          onClose={() => setToast(null)}
        />
      )}
    </AdminShell>
  );
}
