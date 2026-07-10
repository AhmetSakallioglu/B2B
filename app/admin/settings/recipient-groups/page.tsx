"use client";

import { FormEvent, useCallback, useState } from "react";
import {
  AdminAlert,
  AdminButton,
  AdminFieldLabel,
  AdminInput,
  AdminListCard,
  AdminListStack,
  AdminPanel,
} from "@/components/admin/admin-ui";
import { AdminSectionNav } from "@/components/admin/AdminOrdersSubNav";
import { AdminShell } from "@/components/admin/AdminShell";
import { LoadingState } from "@/components/ui/LoadingState";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { ui } from "@/lib/ui-classes";
import type { DealerGroup, DealerGroupMember } from "@/types/dealer-group";

type DealerOption = {
  id: number;
  email: string;
  label: string;
};

function EditGroupModal({
  group,
  dealers,
  onClose,
  onSaved,
}: {
  group: DealerGroup;
  dealers: DealerOption[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description);
  const [members, setMembers] = useState<DealerGroupMember[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadGroup = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/dealer-groups/${group.id}`);

      if (!response.ok) {
        throw new Error("Failed to load group details");
      }

      const data = (await response.json()) as {
        members: DealerGroupMember[];
      };

      setMembers(data.members);
      setSelectedMemberIds(data.members.map((member) => member.userId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load group");
    } finally {
      setIsLoading(false);
    }
  }, [group.id]);

  useDeferredEffect(() => {
    void loadGroup();
  }, [loadGroup]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/dealer-groups/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          memberUserIds: selectedMemberIds,
        }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update group");
      }

      onSaved(`Group "${name}" updated.`);
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to update group");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close edit group dialog"
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
        onClick={onClose}
      />
      <form
        onSubmit={handleSubmit}
        className={`relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden ${ui.adminCard} shadow-2xl`}
      >
        <div className="border-b border-slate-200/80 px-5 py-4 dark:border-zinc-700/50 sm:px-6">
          <h2 className={ui.heading2}>Edit recipient group</h2>
          <p className={`mt-1 ${ui.bodyMuted}`}>Update group details and member list.</p>
        </div>
        <div className="space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
          {error && <AdminAlert tone="error">{error}</AdminAlert>}
          {isLoading ? (
            <LoadingState label="Loading group members..." minHeight="min-h-[160px]" />
          ) : (
            <>
              <label className="block space-y-1.5">
                <AdminFieldLabel>Group name</AdminFieldLabel>
                <AdminInput required value={name} onChange={(event) => setName(event.target.value)} />
              </label>
              <label className="block space-y-1.5">
                <AdminFieldLabel>Description</AdminFieldLabel>
                <AdminInput
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>
              <label className="block space-y-1.5">
                <AdminFieldLabel>Members ({selectedMemberIds.length} selected)</AdminFieldLabel>
                <select
                  multiple
                  size={8}
                  value={selectedMemberIds.map(String)}
                  onChange={(event) => {
                    const values = Array.from(event.target.selectedOptions).map((option) =>
                      Number.parseInt(option.value, 10)
                    );
                    setSelectedMemberIds(values);
                  }}
                  className={`w-full ${ui.select}`}
                >
                  {dealers.map((dealer) => (
                    <option key={dealer.id} value={dealer.id}>
                      {dealer.label}
                    </option>
                  ))}
                </select>
                <p className={`text-xs ${ui.bodyMuted}`}>
                  Current members:{" "}
                  {members.length > 0
                    ? members.map((member) => member.email).join(", ")
                    : "None"}
                </p>
              </label>
            </>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200/80 px-5 py-4 dark:border-zinc-700/50 sm:px-6">
          <AdminButton type="button" onClick={onClose} disabled={isSaving}>
            Cancel
          </AdminButton>
          <AdminButton type="submit" variant="primary" disabled={isSaving || isLoading}>
            {isSaving ? "Saving..." : "Save group"}
          </AdminButton>
        </div>
      </form>
    </div>
  );
}

export default function AdminRecipientGroupsPage() {
  const { confirm } = useConfirm();
  const [groups, setGroups] = useState<DealerGroup[]>([]);
  const [dealers, setDealers] = useState<DealerOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<number[]>([]);
  const [editingGroup, setEditingGroup] = useState<DealerGroup | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/dealer-groups");

      if (!response.ok) {
        throw new Error("Failed to load recipient groups");
      }

      const data = (await response.json()) as {
        groups: DealerGroup[];
        dealers: DealerOption[];
      };

      setGroups(data.groups);
      setDealers(data.dealers);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load recipient groups");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useDeferredEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreateGroup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/dealer-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newGroupName,
          description: newGroupDescription,
          memberUserIds: selectedGroupMembers,
        }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to create group");
      }

      setMessage(`Group "${newGroupName}" created.`);
      setNewGroupName("");
      setNewGroupDescription("");
      setSelectedGroupMembers([]);
      await loadData();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create group");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteGroup = async (group: DealerGroup) => {
    const confirmed = await confirm({
      title: `Delete "${group.name}"?`,
      description: "This group will be removed. Email templates are not affected.",
      confirmLabel: "Delete group",
      cancelLabel: "Keep group",
      tone: "danger",
    });

    if (!confirmed) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/dealer-groups", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: group.id }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to delete group");
      }

      setMessage(`Group "${group.name}" deleted.`);
      await loadData();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete group");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminShell
      wide
      title="Recipient Groups"
      subtitle="Create and manage custom dealer groups for bulk email campaigns"
    >
      <AdminSectionNav variant="campaigns" />

      {message && <AdminAlert tone="success">{message}</AdminAlert>}
      {error && <AdminAlert tone="error">{error}</AdminAlert>}

      <div className="grid gap-6 xl:grid-cols-2">
        <AdminPanel>
          <h2 className={ui.heading2}>Create group</h2>
          <p className={`mt-2 text-sm ${ui.bodyMuted}`}>
            Groups are used when sending bulk emails from Email templates. Tier groups (Tier 1, New,
            etc.) are managed on user profiles.
          </p>
          <form onSubmit={handleCreateGroup} className="mt-6 space-y-4">
            <label className="block space-y-1.5">
              <AdminFieldLabel>Group name</AdminFieldLabel>
              <AdminInput
                required
                value={newGroupName}
                onChange={(event) => setNewGroupName(event.target.value)}
                placeholder="VIP Dealers"
              />
            </label>
            <label className="block space-y-1.5">
              <AdminFieldLabel>Description</AdminFieldLabel>
              <AdminInput
                value={newGroupDescription}
                onChange={(event) => setNewGroupDescription(event.target.value)}
              />
            </label>
            <label className="block space-y-1.5">
              <AdminFieldLabel>Members</AdminFieldLabel>
              <select
                multiple
                size={8}
                value={selectedGroupMembers.map(String)}
                onChange={(event) => {
                  setSelectedGroupMembers(
                    Array.from(event.target.selectedOptions).map((option) =>
                      Number.parseInt(option.value, 10)
                    )
                  );
                }}
                className={`w-full ${ui.select}`}
              >
                {dealers.map((dealer) => (
                  <option key={dealer.id} value={dealer.id}>
                    {dealer.label}
                  </option>
                ))}
              </select>
            </label>
            <AdminButton type="submit" variant="primary" disabled={isSaving}>
              Create group
            </AdminButton>
          </form>
        </AdminPanel>

        <AdminPanel>
          <h2 className={ui.heading2}>Existing groups</h2>
          {isLoading ? (
            <LoadingState label="Loading groups..." minHeight="min-h-[200px]" />
          ) : groups.length === 0 ? (
            <p className={`mt-4 text-sm ${ui.bodyMuted}`}>No custom groups yet.</p>
          ) : (
            <AdminListStack>
              {groups.map((group) => (
                <AdminListCard key={group.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-navy dark:text-cream">{group.name}</p>
                      {group.description && (
                        <p className={`mt-1 text-sm ${ui.bodyMuted}`}>{group.description}</p>
                      )}
                      <p className={`mt-2 text-xs ${ui.bodyMuted}`}>
                        {group.memberCount} member{group.memberCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <AdminButton type="button" onClick={() => setEditingGroup(group)}>
                        Edit
                      </AdminButton>
                      <AdminButton
                        type="button"
                        variant="danger"
                        disabled={isSaving}
                        onClick={() => void handleDeleteGroup(group)}
                      >
                        Delete
                      </AdminButton>
                    </div>
                  </div>
                </AdminListCard>
              ))}
            </AdminListStack>
          )}
        </AdminPanel>
      </div>

      {editingGroup && (
        <EditGroupModal
          group={editingGroup}
          dealers={dealers}
          onClose={() => setEditingGroup(null)}
          onSaved={(successMessage) => {
            setMessage(successMessage);
            void loadData();
          }}
        />
      )}
    </AdminShell>
  );
}
