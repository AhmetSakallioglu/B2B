"use client";

import { useCallback, useState } from "react";
import { AnnouncementCampaignFormModal } from "@/components/admin/announcement/AnnouncementCampaignFormModal";
import { AnnouncementCampaignTable } from "@/components/admin/announcement/AnnouncementCampaignTable";
import { AdminAlert, AdminButton, AdminPanel } from "@/components/admin/admin-ui";
import { AdminShell } from "@/components/admin/AdminShell";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { readJsonResponse } from "@/lib/fetch-json";
import { ui } from "@/lib/ui-classes";
import type { AnnouncementCampaignListItem } from "@/types/announcement";

type FormModalState =
  | { open: false }
  | { open: true; mode: "create" }
  | { open: true; mode: "edit"; campaignId: number };

export default function AdminAnnouncementPage() {
  const { confirm } = useConfirm();
  const [campaigns, setCampaigns] = useState<AnnouncementCampaignListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [formModal, setFormModal] = useState<FormModalState>({ open: false });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCampaigns = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/announcement/campaigns");

      if (response.status === 403) {
        throw new Error("You do not have permission to manage pop-up campaigns.");
      }

      if (!response.ok) {
        const data = await readJsonResponse<{ error?: string }>(response);
        throw new Error(data.error ?? "Failed to load campaigns");
      }

      const data = await readJsonResponse<{ campaigns: AnnouncementCampaignListItem[] }>(
        response
      );
      setCampaigns(data.campaigns);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load campaigns");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useDeferredEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  const handleToggleActive = async (
    campaign: AnnouncementCampaignListItem,
    isActive: boolean
  ) => {
    setTogglingId(campaign.id);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/admin/announcement/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });

      const data = await readJsonResponse<{
        error?: string;
        campaign?: AnnouncementCampaignListItem;
      }>(response);

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update campaign status");
      }

      if (data.campaign) {
        setCampaigns((current) =>
          current.map((entry) => (entry.id === campaign.id ? data.campaign! : entry))
        );
      } else {
        await loadCampaigns();
      }

      setMessage(isActive ? "Campaign activated." : "Campaign deactivated.");
    } catch (toggleError) {
      setError(
        toggleError instanceof Error ? toggleError.message : "Failed to update campaign status"
      );
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (campaign: AnnouncementCampaignListItem) => {
    const confirmed = await confirm({
      title: "Delete campaign",
      description: `Delete "${campaign.title}"? Dealers will no longer see this pop-up.`,
      confirmLabel: "Delete",
      tone: "danger",
    });

    if (!confirmed) {
      return;
    }

    setDeletingId(campaign.id);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/admin/announcement/campaigns/${campaign.id}`, {
        method: "DELETE",
      });

      const data = await readJsonResponse<{ error?: string }>(response);

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to delete campaign");
      }

      setCampaigns((current) => current.filter((entry) => entry.id !== campaign.id));
      setMessage("Campaign deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete campaign");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AdminShell
      wide
      title="Pop-up Campaign Center"
      subtitle="Manage multiple dealer pop-ups with page targeting, frequency rules, and priority scoring"
    >
      <div className="space-y-6">
        {message && <AdminAlert tone="success">{message}</AdminAlert>}
        {error && <AdminAlert tone="error">{error}</AdminAlert>}

        <AdminPanel>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className={ui.heading2}>Campaign overview</h2>
              <p className={`mt-1.5 ${ui.bodyMuted}`}>
                Active campaigns are evaluated by priority when dealers visit matching pages.
              </p>
            </div>
            <AdminButton
              type="button"
              variant="primary"
              size="md"
              onClick={() => setFormModal({ open: true, mode: "create" })}
            >
              Add new campaign
            </AdminButton>
          </div>
        </AdminPanel>

        <AnnouncementCampaignTable
          campaigns={campaigns}
          isLoading={isLoading}
          togglingId={togglingId}
          deletingId={deletingId}
          onEdit={(campaign) =>
            setFormModal({ open: true, mode: "edit", campaignId: campaign.id })
          }
          onDelete={handleDelete}
          onToggleActive={handleToggleActive}
        />
      </div>

      <AnnouncementCampaignFormModal
        open={formModal.open}
        mode={formModal.open ? formModal.mode : "create"}
        campaignId={formModal.open && formModal.mode === "edit" ? formModal.campaignId : null}
        onClose={() => setFormModal({ open: false })}
        onSaved={() => {
          setMessage(
            formModal.open && formModal.mode === "edit"
              ? "Campaign updated."
              : "Campaign created."
          );
          void loadCampaigns();
        }}
      />
    </AdminShell>
  );
}
