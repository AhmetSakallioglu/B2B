"use client";

import {
  AdminBadge,
  AdminButton,
  AdminEmptyState,
} from "@/components/admin/admin-ui";
import { Skeleton } from "@/components/ui/Skeleton";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { ui } from "@/lib/ui-classes";
import {
  ANNOUNCEMENT_FREQUENCY_LABELS,
  type AnnouncementCampaignListItem,
} from "@/types/announcement";

type AnnouncementCampaignTableProps = {
  campaigns: AnnouncementCampaignListItem[];
  isLoading: boolean;
  togglingId: number | null;
  deletingId: number | null;
  onEdit: (campaign: AnnouncementCampaignListItem) => void;
  onDelete: (campaign: AnnouncementCampaignListItem) => void;
  onToggleActive: (campaign: AnnouncementCampaignListItem, isActive: boolean) => void;
};

const SKELETON_ROWS = 4;

function formatTargetPages(targetPages: string[]) {
  if (targetPages.includes("ALL")) {
    return "ALL";
  }

  return targetPages.join(", ");
}

function formatFrequency(campaign: AnnouncementCampaignListItem) {
  const label = ANNOUNCEMENT_FREQUENCY_LABELS[campaign.frequencyType];

  if (campaign.frequencyType === "MAX_LIMIT") {
    return `${label} (${campaign.maxViews})`;
  }

  return label;
}

function CampaignTableSkeleton() {
  return (
    <div className={`overflow-hidden ${ui.adminCard}`}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className={ui.tableHead}>
            <tr>
              {[
                "Campaign title",
                "Format",
                "Target pages",
                "Frequency",
                "Priority",
                "Status",
                "Actions",
              ].map((header) => (
                <th key={header} className={ui.tableHeadCell}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <tr key={index} className={ui.tableRow}>
                <td className={ui.tableCell}>
                  <Skeleton className="h-4 w-40" />
                </td>
                <td className={ui.tableCell}>
                  <Skeleton className="h-4 w-16" />
                </td>
                <td className={ui.tableCell}>
                  <Skeleton className="h-4 w-28" />
                </td>
                <td className={ui.tableCell}>
                  <Skeleton className="h-4 w-24" />
                </td>
                <td className={ui.tableCell}>
                  <Skeleton className="h-4 w-10" />
                </td>
                <td className={ui.tableCell}>
                  <Skeleton className="h-6 w-11 rounded-full" />
                </td>
                <td className={ui.tableCell}>
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-16 rounded-xl" />
                    <Skeleton className="h-8 w-14 rounded-xl" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AnnouncementCampaignTable({
  campaigns,
  isLoading,
  togglingId,
  deletingId,
  onEdit,
  onDelete,
  onToggleActive,
}: AnnouncementCampaignTableProps) {
  if (isLoading) {
    return <CampaignTableSkeleton />;
  }

  if (campaigns.length === 0) {
    return (
      <AdminEmptyState>
        No pop-up campaigns yet. Create your first campaign to start targeting dealer pages.
      </AdminEmptyState>
    );
  }

  return (
    <div className={`overflow-hidden ${ui.adminCard}`}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className={ui.tableHead}>
            <tr>
              <th className={ui.tableHeadCell}>Campaign title</th>
              <th className={ui.tableHeadCell}>Format</th>
              <th className={ui.tableHeadCell}>Target pages</th>
              <th className={ui.tableHeadCell}>Frequency</th>
              <th className={ui.tableHeadCell}>Priority</th>
              <th className={ui.tableHeadCell}>Status</th>
              <th className={`${ui.tableHeadCell} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((campaign) => {
              const isToggling = togglingId === campaign.id;
              const isDeleting = deletingId === campaign.id;

              return (
                <tr key={campaign.id} className={ui.tableRow}>
                  <td className={ui.tableCell}>
                    <p className="font-semibold text-slate-900 dark:text-cream">{campaign.title}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-cream/60">{campaign.name}</p>
                  </td>
                  <td className={ui.tableCell}>
                    <AdminBadge tone={campaign.displayMode === "media" ? "brand" : "neutral"}>
                      {campaign.displayMode === "media"
                        ? campaign.mediaType === "pdf"
                          ? "PDF"
                          : "Image"
                        : "Text"}
                    </AdminBadge>
                  </td>
                  <td className={`${ui.tableCell} max-w-[220px] text-slate-600 dark:text-cream/75`}>
                    <span className="line-clamp-2 font-mono text-xs">
                      {formatTargetPages(campaign.targetPages)}
                    </span>
                  </td>
                  <td className={`${ui.tableCell} text-slate-600 dark:text-cream/75`}>
                    {formatFrequency(campaign)}
                  </td>
                  <td className={ui.tableCell}>
                    <AdminBadge tone="brand">{campaign.priority}</AdminBadge>
                  </td>
                  <td className={ui.tableCell}>
                    <ToggleSwitch
                      id={`campaign-active-${campaign.id}`}
                      checked={campaign.isActive}
                      disabled={isToggling || isDeleting}
                      label={campaign.isActive ? "Active" : "Inactive"}
                      labelHidden
                      onChange={(checked) => onToggleActive(campaign, checked)}
                    />
                  </td>
                  <td className={`${ui.tableCell} text-right`}>
                    <div className="flex justify-end gap-2">
                      <AdminButton
                        type="button"
                        variant="secondary"
                        disabled={isDeleting}
                        onClick={() => onEdit(campaign)}
                      >
                        Edit
                      </AdminButton>
                      <AdminButton
                        type="button"
                        variant="danger"
                        disabled={isDeleting}
                        onClick={() => onDelete(campaign)}
                      >
                        {isDeleting ? "Deleting..." : "Delete"}
                      </AdminButton>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
