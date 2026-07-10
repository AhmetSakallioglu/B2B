"use client";

import Image from "next/image";
import { FormEvent, useEffect, useId, useMemo, useState } from "react";
import {
  AdminAlert,
  AdminButton,
  AdminFieldLabel,
  AdminInput,
  AdminSelect,
  AdminTextarea,
} from "@/components/admin/admin-ui";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { readJsonResponse } from "@/lib/fetch-json";
import { ui } from "@/lib/ui-classes";
import {
  ANNOUNCEMENT_TARGET_PAGE_OPTIONS,
  type AnnouncementCampaignDetail,
  type AnnouncementDisplayMode,
  type AnnouncementFrequencyType,
} from "@/types/announcement";

type AnnouncementCampaignFormModalProps = {
  open: boolean;
  mode: "create" | "edit";
  campaignId: number | null;
  onClose: () => void;
  onSaved: () => void;
};

type CampaignFormState = {
  title: string;
  body: string;
  actionUrl: string;
  buttonLabel: string;
  displayMode: AnnouncementDisplayMode;
  targetPages: string[];
  frequencyType: AnnouncementFrequencyType;
  maxViews: string;
  priority: string;
  isActive: boolean;
};

const EMPTY_FORM: CampaignFormState = {
  title: "",
  body: "",
  actionUrl: "",
  buttonLabel: "",
  displayMode: "template",
  targetPages: ["ALL"],
  frequencyType: "ONCE",
  maxViews: "3",
  priority: "100",
  isActive: true,
};

function applyCampaignToForm(campaign: AnnouncementCampaignDetail): CampaignFormState {
  return {
    title: campaign.title,
    body: campaign.body,
    actionUrl: campaign.actionUrl ?? "",
    buttonLabel: campaign.buttonLabel ?? "",
    displayMode: campaign.displayMode,
    targetPages: campaign.targetPages.length > 0 ? campaign.targetPages : ["ALL"],
    frequencyType: campaign.frequencyType,
    maxViews: String(campaign.maxViews),
    priority: String(campaign.priority),
    isActive: campaign.isActive,
  };
}

function isAllowedMediaFile(file: File) {
  const lowerName = file.name.toLowerCase();

  return (
    file.type === "application/pdf" ||
    file.type === "image/jpeg" ||
    file.type === "image/png" ||
    lowerName.endsWith(".pdf") ||
    lowerName.endsWith(".jpg") ||
    lowerName.endsWith(".jpeg") ||
    lowerName.endsWith(".png")
  );
}

export function AnnouncementCampaignFormModal({
  open,
  mode,
  campaignId,
  onClose,
  onSaved,
}: AnnouncementCampaignFormModalProps) {
  const titleId = useId();
  const [form, setForm] = useState<CampaignFormState>(EMPTY_FORM);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<AnnouncementCampaignDetail["mediaType"]>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [removeMedia, setRemoveMedia] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetMediaState = () => {
    setMediaUrl(null);
    setMediaType(null);
    setSelectedFile(null);
    setRemoveMedia(false);
    setPreviewUrl(null);
    setIsDragging(false);
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    if (mode === "create") {
      setForm(EMPTY_FORM);
      resetMediaState();
      setError(null);
      return;
    }

    if (!campaignId) {
      return;
    }

    const loadCampaign = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/admin/announcement/campaigns/${campaignId}`);

        if (!response.ok) {
          throw new Error("Failed to load campaign");
        }

        const data = await readJsonResponse<{ campaign: AnnouncementCampaignDetail }>(response);
        setForm(applyCampaignToForm(data.campaign));
        setMediaUrl(data.campaign.mediaUrl);
        setMediaType(data.campaign.mediaType);
        setSelectedFile(null);
        setRemoveMedia(false);
        setPreviewUrl(null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load campaign");
      } finally {
        setIsLoading(false);
      }
    };

    void loadCampaign();
  }, [campaignId, mode, open]);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

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

  const effectiveMediaType = useMemo(() => {
    if (selectedFile) {
      if (
        selectedFile.type === "application/pdf" ||
        selectedFile.name.toLowerCase().endsWith(".pdf")
      ) {
        return "pdf" as const;
      }

      return "image" as const;
    }

    return mediaType;
  }, [mediaType, selectedFile]);

  const effectiveMediaUrl = previewUrl ?? mediaUrl;

  const handleFileSelection = (file: File | null) => {
    if (!file) {
      return;
    }

    if (!isAllowedMediaFile(file)) {
      setError("Only JPG, PNG, or PDF files are allowed.");
      return;
    }

    setSelectedFile(file);
    setRemoveMedia(false);
    setError(null);
  };

  if (!open) {
    return null;
  }

  const toggleTargetPage = (value: string) => {
    setForm((current) => {
      const checked = current.targetPages.includes(value);

      if (value === "ALL") {
        return { ...current, targetPages: checked ? [] : ["ALL"] };
      }

      const withoutAll = current.targetPages.filter((entry) => entry !== "ALL");
      const next = checked
        ? withoutAll.filter((entry) => entry !== value)
        : [...withoutAll, value];

      return { ...current, targetPages: next.length > 0 ? next : ["ALL"] };
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    if (form.displayMode === "media" && !selectedFile && (!mediaUrl || removeMedia)) {
      setError("Upload a JPG, PNG, or PDF for media campaigns.");
      setIsSaving(false);
      return;
    }

    const formData = new FormData();
    formData.set("name", form.title.trim());
    formData.set("title", form.title.trim());
    formData.set("body", form.body.trim());
    formData.set("actionUrl", form.actionUrl.trim());
    formData.set("buttonLabel", form.buttonLabel.trim());
    formData.set("displayMode", form.displayMode);
    formData.set("targetPages", JSON.stringify(form.targetPages));
    formData.set("frequencyType", form.frequencyType);
    formData.set("maxViews", form.maxViews);
    formData.set("priority", form.priority);
    formData.set("displayDelay", "3");
    formData.set("isActive", form.isActive ? "true" : "false");
    formData.set("removeMedia", removeMedia ? "true" : "false");

    if (selectedFile) {
      formData.set("file", selectedFile);
    }

    try {
      const response = await fetch(
        mode === "create"
          ? "/api/admin/announcement/campaigns"
          : `/api/admin/announcement/campaigns/${campaignId}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          body: formData,
        }
      );

      const data = await readJsonResponse<{ error?: string }>(response);

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save campaign");
      }

      onSaved();
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save campaign");
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
        className={`flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden shadow-2xl ${ui.adminCard}`}
      >
        <header className="border-b border-slate-200/80 px-5 py-4 dark:border-zinc-700/50 sm:px-6">
          <h2 id={titleId} className={ui.heading3}>
            {mode === "create" ? "Add new campaign" : "Edit campaign"}
          </h2>
          <p className={`mt-1 ${ui.bodyMuted}`}>
            Choose a visual media pop-up or a text template, then configure targeting and frequency.
          </p>
        </header>

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center px-6 py-16">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
              {error && <AdminAlert tone="error">{error}</AdminAlert>}

              <div className={`inline-flex ${ui.tabBar}`}>
                <button
                  type="button"
                  className={form.displayMode === "media" ? ui.tabActive : ui.tabIdle}
                  onClick={() => setForm((current) => ({ ...current, displayMode: "media" }))}
                >
                  Upload media
                </button>
                <button
                  type="button"
                  className={form.displayMode === "template" ? ui.tabActive : ui.tabIdle}
                  onClick={() => setForm((current) => ({ ...current, displayMode: "template" }))}
                >
                  Text template
                </button>
              </div>

              <label className="block space-y-1.5">
                <AdminFieldLabel>Campaign title</AdminFieldLabel>
                <AdminInput
                  required
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Spring 2026 catalog update"
                />
              </label>

              {form.displayMode === "media" ? (
                <div className="space-y-4">
                  <div
                    onDragOver={(event) => {
                      event.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setIsDragging(false);
                      handleFileSelection(event.dataTransfer.files[0] ?? null);
                    }}
                    className={`rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
                      isDragging
                        ? "border-brand bg-brand-light/20"
                        : "border-slate-300 bg-slate-50/70 dark:border-zinc-700/50 dark:bg-navy-hover/20"
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-900 dark:text-cream">
                      Drop JPG, PNG, or PDF here
                    </p>
                    <p className={`mt-2 ${ui.bodyMuted}`}>Images up to 8 MB · PDFs up to 15 MB</p>
                    <label className={`mt-5 inline-flex cursor-pointer ${ui.btnSecondary}`}>
                      Browse files
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                        className="sr-only"
                        onChange={(event) =>
                          handleFileSelection(event.target.files?.[0] ?? null)
                        }
                      />
                    </label>
                  </div>

                  {(effectiveMediaUrl || selectedFile) && !removeMedia && (
                    <div className={`${ui.adminCard} p-4`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-cream">
                            {selectedFile?.name ?? "Current media"}
                          </p>
                          <p className={`mt-1 text-xs ${ui.bodyMuted}`}>
                            {effectiveMediaType === "pdf" ? "PDF document" : "Image preview"}
                          </p>
                        </div>
                        <AdminButton
                          type="button"
                          variant="danger"
                          onClick={() => {
                            setSelectedFile(null);
                            setRemoveMedia(true);
                            setMediaUrl(null);
                            setMediaType(null);
                          }}
                        >
                          Remove media
                        </AdminButton>
                      </div>

                      {effectiveMediaType === "image" && effectiveMediaUrl && (
                        <div className="relative mt-4 overflow-hidden rounded-xl border border-slate-200/80 dark:border-zinc-700/50">
                          {previewUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={previewUrl}
                              alt="Campaign preview"
                              className="h-auto max-h-64 w-full object-contain"
                            />
                          ) : (
                            <Image
                              src={effectiveMediaUrl}
                              alt="Campaign preview"
                              width={1200}
                              height={800}
                              className="h-auto max-h-64 w-full object-contain"
                            />
                          )}
                        </div>
                      )}

                      {effectiveMediaType === "pdf" && (
                        <div className="mt-4 rounded-xl border border-red-200/80 bg-red-50 px-4 py-5 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
                          PDF selected. Dealers will see a download button in the pop-up.
                          {effectiveMediaUrl && !previewUrl && (
                            <a
                              href={effectiveMediaUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-3 inline-flex font-semibold underline underline-offset-2"
                            >
                              Preview current PDF
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <label className="block space-y-1.5">
                    <AdminFieldLabel>Body text</AdminFieldLabel>
                    <AdminTextarea
                      required
                      rows={5}
                      value={form.body}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, body: event.target.value }))
                      }
                      placeholder="Share pricing, lead-time, or policy updates with your dealer network."
                    />
                  </label>
                </>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5 sm:col-span-2">
                  <AdminFieldLabel>Action URL (optional)</AdminFieldLabel>
                  <AdminInput
                    value={form.actionUrl}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, actionUrl: event.target.value }))
                    }
                    placeholder="/catalog or https://example.com"
                  />
                </label>

                <label className="block space-y-1.5 sm:col-span-2">
                  <AdminFieldLabel>Button label (optional)</AdminFieldLabel>
                  <AdminInput
                    value={form.buttonLabel}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, buttonLabel: event.target.value }))
                    }
                    placeholder="View catalog"
                  />
                  <p className={`text-xs ${ui.bodyMuted}`}>
                    Leave empty to use &quot;View details&quot; when an action URL is provided.
                  </p>
                </label>
              </div>

              <div className="space-y-2">
                <AdminFieldLabel>Target pages</AdminFieldLabel>
                <div className="flex flex-wrap gap-2">
                  {ANNOUNCEMENT_TARGET_PAGE_OPTIONS.map((option) => {
                    const checked = form.targetPages.includes(option.value);

                    return (
                      <label
                        key={option.value}
                        className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
                          checked
                            ? "border-brand bg-brand-light/30 text-slate-900 dark:text-cream"
                            : "border-slate-200/80 bg-white text-slate-600 dark:border-zinc-700/50 dark:bg-navy dark:text-cream/70"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={() => toggleTargetPage(option.value)}
                        />
                        {option.label}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <AdminFieldLabel>Frequency type</AdminFieldLabel>
                  <AdminSelect
                    value={form.frequencyType}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        frequencyType: event.target.value as AnnouncementFrequencyType,
                      }))
                    }
                  >
                    <option value="ONCE">Once per version</option>
                    <option value="EVERY_SESSION">Every session</option>
                    <option value="MAX_LIMIT">Max view limit</option>
                  </AdminSelect>
                </label>

                {form.frequencyType === "MAX_LIMIT" && (
                  <label className="block space-y-1.5">
                    <AdminFieldLabel>Max views</AdminFieldLabel>
                    <AdminInput
                      type="number"
                      min="1"
                      max="100"
                      required
                      value={form.maxViews}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, maxViews: event.target.value }))
                      }
                    />
                  </label>
                )}

                <label className="block space-y-1.5 sm:col-span-2">
                  <AdminFieldLabel>Priority score</AdminFieldLabel>
                  <AdminInput
                    type="number"
                    min="0"
                    max="1000"
                    required
                    value={form.priority}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, priority: event.target.value }))
                    }
                  />
                  <p className={`text-xs ${ui.bodyMuted}`}>
                    Higher scores win when multiple pop-ups match the same page.
                  </p>
                </label>
              </div>
            </div>

            <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200/80 px-5 py-4 dark:border-zinc-700/50 sm:px-6">
              <AdminButton type="button" disabled={isSaving} onClick={onClose}>
                Cancel
              </AdminButton>
              <AdminButton type="submit" variant="primary" size="md" disabled={isSaving}>
                {isSaving ? "Saving..." : mode === "create" ? "Create campaign" : "Save changes"}
              </AdminButton>
            </footer>
          </form>
        )}
      </div>
    </div>
  );
}
