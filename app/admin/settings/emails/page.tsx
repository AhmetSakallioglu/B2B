"use client";

import { FormEvent, useCallback, useState } from "react";
import {
  AdminAlert,
  AdminBadge,
  AdminButton,
  AdminFieldLabel,
  AdminInput,
  AdminListCard,
  AdminListStack,
  AdminPanel,
  AdminSelect,
  AdminTextarea,
} from "@/components/admin/admin-ui";
import { AdminSectionNav } from "@/components/admin/AdminOrdersSubNav";
import { EmailTemplateVariablesReference } from "@/components/admin/EmailTemplateVariablesReference";
import { AdminShell } from "@/components/admin/AdminShell";
import { LoadingState } from "@/components/ui/LoadingState";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { ui } from "@/lib/ui-classes";
import type { DealerGroup } from "@/types/dealer-group";
import type { EmailTemplate } from "@/types/email-template";
import { USER_GROUP_TAGS, type UserGroupTag } from "@/types/user-segmentation";

type DealerOption = {
  id: number;
  email: string;
  label: string;
};

const EMPTY_FORM = {
  name: "",
  subject: "",
  bodyHtml: "",
  ctaLabel: "",
  ctaHref: "",
  sortOrder: "0",
  automationStage: "",
  delayHours: "",
  automationEnabled: false,
  isActive: true,
  issuePromoOnSend: false,
  promoDiscountPercent: "",
  promoExpiryDays: "",
};

function SendToGroupModal({
  template,
  dealerGroups,
  onClose,
  onSent,
}: {
  template: EmailTemplate;
  dealerGroups: DealerGroup[];
  onClose: () => void;
  onSent: (message: string) => void;
}) {
  const [targetType, setTargetType] = useState<"tier" | "dealer_group" | "all">("tier");
  const [groupTag, setGroupTag] = useState<UserGroupTag>("New");
  const [dealerGroupId, setDealerGroupId] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSending(true);
    setError(null);

    const payload =
      targetType === "all"
        ? { templateId: template.id, sendToAll: true }
        : targetType === "dealer_group"
          ? {
              templateId: template.id,
              dealerGroupId: Number.parseInt(dealerGroupId, 10),
            }
          : { templateId: template.id, groupTag };

    try {
      const response = await fetch("/api/admin/email-templates/send-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as { message?: string; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to send bulk email");
      }

      onSent(data.message ?? "Bulk email sent.");
      onClose();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Failed to send bulk email");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close send to group dialog"
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
        onClick={onClose}
      />
      <form
        onSubmit={handleSubmit}
        className={`relative z-10 w-full max-w-lg overflow-hidden ${ui.adminCard} shadow-2xl`}
      >
        <div className="border-b border-slate-200/80 px-5 py-4 dark:border-zinc-700/50 sm:px-6">
          <h2 className={ui.heading2}>Send to group</h2>
          <p className={`mt-1 ${ui.bodyMuted}`}>
            Send &quot;{template.name}&quot; to a tier group, custom dealer group, or all approved
            customers.
          </p>
        </div>
        <div className="space-y-4 px-5 py-5 sm:px-6">
          {error && <AdminAlert tone="error">{error}</AdminAlert>}
          <label className="block space-y-1.5">
            <AdminFieldLabel>Target type</AdminFieldLabel>
            <AdminSelect
              value={targetType}
              onChange={(event) =>
                setTargetType(event.target.value as "tier" | "dealer_group" | "all")
              }
            >
              <option value="tier">Tier group (Tier 1, New, etc.)</option>
              <option value="dealer_group">Custom dealer group</option>
              <option value="all">All approved customers</option>
            </AdminSelect>
          </label>
          {targetType === "tier" && (
            <label className="block space-y-1.5">
              <AdminFieldLabel>Tier group</AdminFieldLabel>
              <AdminSelect
                value={groupTag}
                onChange={(event) => setGroupTag(event.target.value as UserGroupTag)}
              >
                {USER_GROUP_TAGS.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </AdminSelect>
            </label>
          )}
          {targetType === "dealer_group" && (
            <label className="block space-y-1.5">
              <AdminFieldLabel>Custom dealer group</AdminFieldLabel>
              <AdminSelect
                required
                value={dealerGroupId}
                onChange={(event) => setDealerGroupId(event.target.value)}
              >
                <option value="">Select a group</option>
                {dealerGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name} ({group.memberCount} dealers)
                  </option>
                ))}
              </AdminSelect>
            </label>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200/80 px-5 py-4 dark:border-zinc-700/50 sm:px-6">
          <AdminButton type="button" onClick={onClose} disabled={isSending}>
            Cancel
          </AdminButton>
          <AdminButton type="submit" variant="primary" disabled={isSending}>
            {isSending ? "Sending..." : "Send to group"}
          </AdminButton>
        </div>
      </form>
    </div>
  );
}

export default function AdminEmailTemplatesPage() {
  const { confirm } = useConfirm();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [dealerGroups, setDealerGroups] = useState<DealerGroup[]>([]);
  const [dealers, setDealers] = useState<DealerOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [bulkSendTemplate, setBulkSendTemplate] = useState<EmailTemplate | null>(null);
  const [defaultPromoExpiryDays, setDefaultPromoExpiryDays] = useState(7);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [templatesResponse, groupsResponse] = await Promise.all([
        fetch("/api/admin/email-templates"),
        fetch("/api/admin/dealer-groups"),
      ]);

      if (!templatesResponse.ok) {
        throw new Error("Failed to load email templates");
      }

      const templatesData = (await templatesResponse.json()) as {
        templates: EmailTemplate[];
        promoExpiryDays?: number;
      };
      setTemplates(templatesData.templates);
      if (typeof templatesData.promoExpiryDays === "number") {
        setDefaultPromoExpiryDays(templatesData.promoExpiryDays);
      }

      if (groupsResponse.ok) {
        const groupsData = (await groupsResponse.json()) as {
          groups: DealerGroup[];
          dealers: DealerOption[];
        };
        setDealerGroups(groupsData.groups);
        setDealers(groupsData.dealers);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load email templates");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useDeferredEffect(() => {
    void loadData();
  }, [loadData]);

  const startEdit = (template: EmailTemplate) => {
    setEditingId(template.id);
    setShowCreateForm(false);
    setForm({
      name: template.name,
      subject: template.subject,
      bodyHtml: template.bodyHtml,
      ctaLabel: template.ctaLabel ?? "",
      ctaHref: template.ctaHref ?? "",
      sortOrder: String(template.sortOrder),
      automationStage: template.automationStage ? String(template.automationStage) : "",
      delayHours: template.delayHours ? String(template.delayHours) : "",
      automationEnabled: template.automationEnabled,
      isActive: template.isActive,
      issuePromoOnSend: template.issuePromoOnSend,
      promoDiscountPercent: template.promoDiscountPercent
        ? String(template.promoDiscountPercent)
        : "",
      promoExpiryDays: template.promoExpiryDays ? String(template.promoExpiryDays) : "",
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setShowCreateForm(false);
    setForm(EMPTY_FORM);
  };

  const buildPayload = () => ({
    name: form.name,
    subject: form.subject,
    bodyHtml: form.bodyHtml,
    ctaLabel: form.ctaLabel || null,
    ctaHref: form.ctaHref || null,
    sortOrder: Number.parseInt(form.sortOrder, 10) || 0,
    isActive: form.isActive,
    automationEnabled: form.automationEnabled,
    automationStage: form.automationStage
      ? (Number.parseInt(form.automationStage, 10) as 1 | 2 | 3)
      : null,
    delayHours: form.delayHours ? Number.parseFloat(form.delayHours) : null,
    issuePromoOnSend: form.issuePromoOnSend,
    promoDiscountPercent: form.promoDiscountPercent
      ? Number.parseFloat(form.promoDiscountPercent)
      : null,
    promoExpiryDays: form.promoExpiryDays ? Number.parseInt(form.promoExpiryDays, 10) : null,
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(
        editingId ? `/api/admin/email-templates/${editingId}` : "/api/admin/email-templates",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload()),
        }
      );

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save template");
      }

      setMessage(editingId ? "Template updated." : "Template created.");
      resetForm();
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save template");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleTemplate = async (
    template: EmailTemplate,
    patch: { isActive?: boolean; automationEnabled?: boolean }
  ) => {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/email-templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toggleOnly: true, ...patch }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update template");
      }

      await loadData();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Failed to update template");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (template: EmailTemplate) => {
    if (template.isSystemDefault) {
      return;
    }

    const confirmed = await confirm({
      title: "Delete this template?",
      description: `"${template.name}" will be permanently removed.`,
      confirmLabel: "Delete template",
      cancelLabel: "Keep template",
      tone: "danger",
    });

    if (!confirmed) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/email-templates/${template.id}`, {
        method: "DELETE",
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to delete template");
      }

      setMessage("Template deleted.");
      await loadData();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete template");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminShell
      wide
      title="Email Templates"
      subtitle="Manage dealer email templates, automation timing, and bulk campaigns"
    >
      <AdminSectionNav variant="campaigns" />

      <div className="mb-6 flex flex-wrap justify-end">
        <AdminButton
          type="button"
          variant="primary"
          onClick={() => {
            setShowCreateForm(true);
            setEditingId(null);
            setForm(EMPTY_FORM);
          }}
        >
          Add new template
        </AdminButton>
      </div>

      {message && <AdminAlert tone="success">{message}</AdminAlert>}
      {error && <AdminAlert tone="error">{error}</AdminAlert>}

      {(showCreateForm || editingId !== null) && (
        <AdminPanel className="mb-6">
          <h2 className={ui.heading2}>{editingId ? "Edit template" : "Create template"}</h2>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <AdminFieldLabel>Template name</AdminFieldLabel>
                <AdminInput
                  required
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                />
              </label>
              <label className="block space-y-1.5">
                <AdminFieldLabel>Sort order</AdminFieldLabel>
                <AdminInput
                  type="number"
                  min="0"
                  value={form.sortOrder}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, sortOrder: event.target.value }))
                  }
                />
              </label>
            </div>
            <label className="block space-y-1.5">
              <AdminFieldLabel>Subject</AdminFieldLabel>
              <AdminInput
                required
                value={form.subject}
                onChange={(event) =>
                  setForm((current) => ({ ...current, subject: event.target.value }))
                }
              />
            </label>
            <label className="block space-y-1.5">
              <AdminFieldLabel>Body HTML</AdminFieldLabel>
              <AdminTextarea
                required
                rows={12}
                value={form.bodyHtml}
                onChange={(event) =>
                  setForm((current) => ({ ...current, bodyHtml: event.target.value }))
                }
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block space-y-1.5">
                <AdminFieldLabel>Automation step</AdminFieldLabel>
                <AdminSelect
                  value={form.automationStage}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, automationStage: event.target.value }))
                  }
                >
                  <option value="">Manual / bulk only</option>
                  <option value="1">Step 1 (2h default)</option>
                  <option value="2">Step 2 (24h default)</option>
                  <option value="3">Step 3 (48h default)</option>
                </AdminSelect>
              </label>
              <label className="block space-y-1.5">
                <AdminFieldLabel>Delay hours</AdminFieldLabel>
                <AdminInput
                  type="number"
                  min="0.5"
                  max="720"
                  step="0.5"
                  value={form.delayHours}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, delayHours: event.target.value }))
                  }
                  placeholder="Uses step default if empty"
                />
              </label>
              <div className="flex items-end pb-1">
                <ToggleSwitch
                  id="form-template-active"
                  checked={form.isActive}
                  onChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))}
                  label={form.isActive ? "Active" : "Inactive"}
                />
              </div>
              <div className="flex items-end pb-1">
                <ToggleSwitch
                  id="form-automation-enabled"
                  checked={form.automationEnabled}
                  onChange={(checked) =>
                    setForm((current) => ({ ...current, automationEnabled: checked }))
                  }
                  label={form.automationEnabled ? "Automation on" : "Automation off"}
                />
              </div>
            </div>
            <div className="rounded-xl border border-slate-200/80 p-4 dark:border-zinc-700/50">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-cream">
                    Include personal coupon
                  </p>
                  <p className={`mt-1 text-sm ${ui.bodyMuted}`}>
                    Generates a unique code per recipient when this template is sent manually or in
                    bulk. Use {"{{discount_code}}"}, {"{{discount_percent}}"}, {"{{discount_expiry}}"}
                    , or {"{{discount_expiry_short}}"} in the body.
                  </p>
                </div>
                <ToggleSwitch
                  id="form-issue-promo"
                  checked={form.issuePromoOnSend}
                  onChange={(checked) =>
                    setForm((current) => ({ ...current, issuePromoOnSend: checked }))
                  }
                  label={form.issuePromoOnSend ? "On" : "Off"}
                />
              </div>
              {form.issuePromoOnSend && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-1.5">
                    <AdminFieldLabel>Coupon discount % (optional)</AdminFieldLabel>
                    <AdminInput
                      type="number"
                      min="0.01"
                      max="100"
                      step="0.01"
                      value={form.promoDiscountPercent}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          promoDiscountPercent: event.target.value,
                        }))
                      }
                      placeholder="Uses coupon settings if empty"
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <AdminFieldLabel>Valid for (days, optional)</AdminFieldLabel>
                    <AdminInput
                      type="number"
                      min="1"
                      max="365"
                      step="1"
                      value={form.promoExpiryDays}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          promoExpiryDays: event.target.value,
                        }))
                      }
                      placeholder={`Default: ${defaultPromoExpiryDays} days`}
                    />
                  </label>
                </div>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <AdminFieldLabel>CTA label (optional)</AdminFieldLabel>
                <AdminInput
                  value={form.ctaLabel}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, ctaLabel: event.target.value }))
                  }
                />
              </label>
              <label className="block space-y-1.5">
                <AdminFieldLabel>CTA link (optional)</AdminFieldLabel>
                <AdminInput
                  value={form.ctaHref}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, ctaHref: event.target.value }))
                  }
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <AdminButton type="submit" variant="primary" disabled={isSaving}>
                {isSaving ? "Saving..." : editingId ? "Save changes" : "Create template"}
              </AdminButton>
              <AdminButton type="button" onClick={resetForm} disabled={isSaving}>
                Cancel
              </AdminButton>
            </div>
          </form>
        </AdminPanel>
      )}

      {isLoading ? (
        <LoadingState label="Loading email templates..." minHeight="min-h-[240px]" />
      ) : (
        <div className="space-y-6">
          <AdminListStack>
            {templates.map((template) => (
              <AdminListCard key={template.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-navy dark:text-cream">{template.name}</p>
                      {template.isSystemDefault && <AdminBadge tone="brand">System default</AdminBadge>}
                      {template.automationStage && (
                        <AdminBadge tone="neutral">Step {template.automationStage}</AdminBadge>
                      )}
                      {!template.isActive && <AdminBadge tone="danger">Inactive</AdminBadge>}
                      {template.issuePromoOnSend && (
                        <AdminBadge tone="brand">
                          Includes coupon
                          {template.promoExpiryDays ? ` · ${template.promoExpiryDays}d` : ""}
                        </AdminBadge>
                      )}
                      {template.isActive && !template.automationEnabled && template.automationStage && (
                        <AdminBadge tone="neutral">Automation paused</AdminBadge>
                      )}
                    </div>
                    <p className={`mt-2 text-sm ${ui.bodyMuted}`}>{template.subject}</p>
                    {template.delayHours && (
                      <p className={`mt-1 text-xs ${ui.bodyMuted}`}>
                        Sends after {template.delayHours} hours of cart inactivity
                      </p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-4">
                      <ToggleSwitch
                        id={`template-active-${template.id}`}
                        checked={template.isActive}
                        onChange={(checked) =>
                          void handleToggleTemplate(template, { isActive: checked })
                        }
                        disabled={isSaving}
                        label={template.isActive ? "Active" : "Inactive"}
                      />
                      {template.automationStage && (
                        <ToggleSwitch
                          id={`template-automation-${template.id}`}
                          checked={template.automationEnabled}
                          onChange={(checked) =>
                            void handleToggleTemplate(template, { automationEnabled: checked })
                          }
                          disabled={isSaving}
                          label={template.automationEnabled ? "Automation on" : "Automation off"}
                        />
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <AdminButton type="button" variant="primary" onClick={() => setBulkSendTemplate(template)}>
                      Send to group
                    </AdminButton>
                    <AdminButton type="button" onClick={() => startEdit(template)}>
                      Edit
                    </AdminButton>
                    {!template.isSystemDefault && (
                      <AdminButton
                        type="button"
                        variant="danger"
                        disabled={isSaving}
                        onClick={() => void handleDelete(template)}
                      >
                        Delete
                      </AdminButton>
                    )}
                  </div>
                </div>
              </AdminListCard>
            ))}
          </AdminListStack>

          <EmailTemplateVariablesReference mode="full" defaultPromoExpiryDays={defaultPromoExpiryDays} />
        </div>
      )}

      {bulkSendTemplate && (
        <SendToGroupModal
          template={bulkSendTemplate}
          dealerGroups={dealerGroups}
          onClose={() => setBulkSendTemplate(null)}
          onSent={(successMessage) => setMessage(successMessage)}
        />
      )}
    </AdminShell>
  );
}
