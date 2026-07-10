"use client";

import { FormEvent, useCallback, useState } from "react";
import {
  AdminActionRow,
  AdminAlert,
  AdminBadge,
  AdminButton,
  AdminEmptyState,
  AdminFieldLabel,
  AdminInput,
  AdminListCard,
  AdminListStack,
  AdminPanel,
  AdminTextarea,
} from "@/components/admin/admin-ui";
import { AdminShell } from "@/components/admin/AdminShell";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import type { CustomerTier } from "@/types/customer-tier";

const EMPTY_TIER_FORM = {
  name: "",
  level: "",
  discountPercent: "",
  description: "",
};

export default function AdminTiersPage() {
  const { confirm } = useConfirm();
  const [tiers, setTiers] = useState<CustomerTier[]>([]);
  const [newTier, setNewTier] = useState(EMPTY_TIER_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_TIER_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadTiers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/tiers");

      if (!response.ok) {
        throw new Error("Failed to load tiers");
      }

      const data = (await response.json()) as { tiers: CustomerTier[] };
      setTiers(data.tiers);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load tiers");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useDeferredEffect(() => {
    void loadTiers();
  }, [loadTiers]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/tiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTier.name.trim(),
          level: Number.parseInt(newTier.level, 10),
          discountPercent: Number.parseFloat(newTier.discountPercent),
          description: newTier.description.trim(),
        }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to create tier");
      }

      setNewTier(EMPTY_TIER_FORM);
      setMessage("Tier created.");
      await loadTiers();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to create tier");
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (tier: CustomerTier) => {
    setEditingId(tier.id);
    setEditForm({
      name: tier.name,
      level: String(tier.level),
      discountPercent: String(tier.discountPercent),
      description: tier.description,
    });
  };

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (editingId === null) {
      return;
    }

    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/admin/tiers/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name.trim(),
          level: Number.parseInt(editForm.level, 10),
          discountPercent: Number.parseFloat(editForm.discountPercent),
          description: editForm.description.trim(),
        }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update tier");
      }

      setEditingId(null);
      setMessage("Tier updated.");
      await loadTiers();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to update tier");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (tierId: number) => {
    const confirmed = await confirm({
      title: "Delete this tier?",
      description: "Assigned users will lose their discount.",
      confirmLabel: "Delete tier",
      cancelLabel: "Keep tier",
      tone: "danger",
    });

    if (!confirmed) {
      return;
    }

    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/admin/tiers/${tierId}`, {
        method: "DELETE",
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to delete tier");
      }

      setMessage("Tier deleted.");
      await loadTiers();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete tier");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminShell
      wide
      title="Customer Tiers"
      subtitle="Define discount levels such as 1st degree 60% and 2nd degree 50%"
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <AdminPanel>
          <h2 className="text-lg font-semibold text-navy dark:text-cream">
            Add tier
          </h2>
          <p className="mt-2 text-sm text-muted dark:text-cream/70">
            Lower level numbers represent higher priority tiers.
          </p>

          <form onSubmit={handleCreate} className="mt-6 space-y-4">
            <label className="block space-y-1.5">
              <AdminFieldLabel>Name</AdminFieldLabel>
              <AdminInput
                required
                value={newTier.name}
                onChange={(event) =>
                  setNewTier((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="3rd degree"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <AdminFieldLabel>Level</AdminFieldLabel>
                <AdminInput
                  required
                  type="number"
                  min="1"
                  value={newTier.level}
                  onChange={(event) =>
                    setNewTier((current) => ({ ...current, level: event.target.value }))
                  }
                />
              </label>
              <label className="block space-y-1.5">
                <AdminFieldLabel>Discount %</AdminFieldLabel>
                <AdminInput
                  required
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={newTier.discountPercent}
                  onChange={(event) =>
                    setNewTier((current) => ({
                      ...current,
                      discountPercent: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <label className="block space-y-1.5">
              <AdminFieldLabel>Description</AdminFieldLabel>
              <AdminTextarea
                rows={3}
                value={newTier.description}
                onChange={(event) =>
                  setNewTier((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </label>
            <AdminButton
              type="submit"
              variant="primary"
              size="md"
              disabled={isSaving}
              className="w-full"
            >
              Add tier
            </AdminButton>
          </form>
        </AdminPanel>

        <AdminPanel>
          <h2 className="text-lg font-semibold text-navy dark:text-cream">
            Tier list
          </h2>

          {message && <AdminAlert tone="success">{message}</AdminAlert>}
          {error && <AdminAlert tone="error">{error}</AdminAlert>}

          {isLoading ? (
            <p className="mt-6 text-sm text-muted dark:text-cream/70">Loading tiers...</p>
          ) : tiers.length === 0 ? (
            <AdminEmptyState>No tiers defined yet.</AdminEmptyState>
          ) : (
            <AdminListStack>
              {tiers.map((tier) => (
                <AdminListCard key={tier.id}>
                  {editingId === tier.id ? (
                    <form onSubmit={handleUpdate} className="space-y-3">
                      <AdminInput
                        required
                        value={editForm.name}
                        onChange={(event) =>
                          setEditForm((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <AdminInput
                          required
                          type="number"
                          min="1"
                          value={editForm.level}
                          onChange={(event) =>
                            setEditForm((current) => ({
                              ...current,
                              level: event.target.value,
                            }))
                          }
                        />
                        <AdminInput
                          required
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={editForm.discountPercent}
                          onChange={(event) =>
                            setEditForm((current) => ({
                              ...current,
                              discountPercent: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <AdminTextarea
                        rows={2}
                        value={editForm.description}
                        onChange={(event) =>
                          setEditForm((current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                      />
                      <AdminActionRow>
                        <AdminButton type="submit" variant="primary" disabled={isSaving}>
                          Save
                        </AdminButton>
                        <AdminButton type="button" onClick={() => setEditingId(null)}>
                          Cancel
                        </AdminButton>
                      </AdminActionRow>
                    </form>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-navy dark:text-cream">
                            {tier.name}
                          </p>
                          <p className="mt-1 text-sm text-muted dark:text-cream/70">
                            Level {tier.level}
                          </p>
                        </div>
                        <AdminBadge tone="brand">{tier.discountPercent}% off</AdminBadge>
                      </div>
                      {tier.description && (
                        <p className="mt-3 text-sm leading-relaxed text-muted dark:text-cream/75">
                          {tier.description}
                        </p>
                      )}
                      <AdminActionRow>
                        <AdminButton type="button" onClick={() => startEdit(tier)}>
                          Edit
                        </AdminButton>
                        <AdminButton
                          type="button"
                          variant="danger"
                          onClick={() => handleDelete(tier.id)}
                        >
                          Delete
                        </AdminButton>
                      </AdminActionRow>
                    </>
                  )}
                </AdminListCard>
              ))}
            </AdminListStack>
          )}
        </AdminPanel>
      </div>
    </AdminShell>
  );
}
