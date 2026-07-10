"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  AdminAlert,
  AdminButton,
  AdminFieldLabel,
  AdminInput,
  AdminSelect,
} from "@/components/admin/admin-ui";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminSectionNav } from "@/components/admin/AdminOrdersSubNav";
import { LoadingState } from "@/components/ui/LoadingState";
import { MailIcon } from "@/components/ui/Icon";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { formatDate, formatPrice } from "@/lib/order-display";
import { ui } from "@/lib/ui-classes";
import {
  ABANDONED_MAIL_STATUS_LABELS,
  type AbandonedCartDealerContext,
  type AbandonedCartListItem,
} from "@/types/abandoned-cart";
import type { EmailTemplate } from "@/types/email-template";
import {
  AUTOMATION_STEP_LABELS,
  AUTOMATION_TARGET_GROUPS,
  type AutomationSetting,
} from "@/types/user-segmentation";

function CartItemsModal({
  cart,
  onClose,
}: {
  cart: AbandonedCartDealerContext;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close cart details"
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className={`relative z-10 w-full max-w-3xl overflow-hidden ${ui.adminCard} shadow-2xl`}>
        <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4 dark:border-zinc-700/50 sm:px-6">
          <div>
            <h2 className={ui.heading2}>Cart items</h2>
            <p className={`mt-1 ${ui.bodyMuted}`}>
              {cart.companyName || cart.contactName || cart.email}
            </p>
          </div>
          <AdminButton type="button" onClick={onClose}>
            Close
          </AdminButton>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-5 sm:px-6">
          <div className="space-y-3">
            {cart.items.map((item) => (
              <div
                key={item.variantId}
                className="flex gap-4 rounded-xl border border-slate-200/80 p-3 dark:border-zinc-700/50"
              >
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-navy-hover">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 dark:text-cream">{item.name}</p>
                  <p className={`mt-1 text-sm ${ui.bodyMuted}`}>
                    Qty {item.quantity} · {formatPrice(item.unitPrice)} each
                  </p>
                </div>
                <p className="text-sm font-semibold text-slate-900 dark:text-cream">
                  {formatPrice(item.lineTotal)}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between border-t border-slate-200/80 pt-4 dark:border-zinc-700/50">
            <span className="font-semibold text-slate-900 dark:text-cream">Cart total</span>
            <span className="text-lg font-bold text-brand">{formatPrice(cart.cartTotal)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SendTemplateEmailModal({
  cart,
  onClose,
  onSent,
}: {
  cart: AbandonedCartListItem;
  onClose: () => void;
  onSent: (message: string) => void;
}) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    setIsLoadingTemplates(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/email-templates");

      if (!response.ok) {
        throw new Error("Failed to load email templates");
      }

      const data = (await response.json()) as { templates: EmailTemplate[] };
      setTemplates(data.templates);

      if (data.templates.length > 0) {
        setTemplateId(String(data.templates[0].id));
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load email templates");
    } finally {
      setIsLoadingTemplates(false);
    }
  }, []);

  useDeferredEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!templateId) {
      setError("Select an email template.");
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/abandoned-carts/send-manual-mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: cart.userId, templateId: Number.parseInt(templateId, 10) }),
      });

      const data = (await response.json()) as { message?: string; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to send email");
      }

      onSent(data.message ?? "Email sent.");
      onClose();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Failed to send email");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close send email dialog"
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
        onClick={onClose}
      />
      <form
        onSubmit={handleSubmit}
        className={`relative z-10 w-full max-w-xl overflow-hidden ${ui.adminCard} shadow-2xl`}
      >
        <div className="border-b border-slate-200/80 px-5 py-4 dark:border-zinc-700/50 sm:px-6">
          <h2 className={ui.heading2}>Send email</h2>
          <p className={`mt-1 ${ui.bodyMuted}`}>
            To {cart.contactName || cart.companyName || cart.email}
          </p>
        </div>
        <div className="space-y-4 px-5 py-5 sm:px-6">
          {error && <AdminAlert tone="error">{error}</AdminAlert>}
          {isLoadingTemplates ? (
            <LoadingState label="Loading templates..." minHeight="min-h-[120px]" />
          ) : templates.length === 0 ? (
            <AdminAlert tone="error">
              No email templates found.{" "}
              <Link href="/admin/settings/emails" className="font-semibold underline">
                Create a template
              </Link>{" "}
              first.
            </AdminAlert>
          ) : (
            <label className="block space-y-1.5">
              <AdminFieldLabel>Email template</AdminFieldLabel>
              <AdminSelect
                required
                value={templateId}
                onChange={(event) => setTemplateId(event.target.value)}
              >
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </AdminSelect>
              {templateId && (
                <p className={`text-sm ${ui.bodyMuted}`}>
                  Subject: {templates.find((template) => String(template.id) === templateId)?.subject}
                </p>
              )}
            </label>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200/80 px-5 py-4 dark:border-zinc-700/50 sm:px-6">
          <AdminButton type="button" onClick={onClose} disabled={isSending}>
            Cancel
          </AdminButton>
          <AdminButton
            type="submit"
            variant="primary"
            disabled={isSending || isLoadingTemplates || templates.length === 0}
          >
            {isSending ? "Sending..." : "Send now"}
          </AdminButton>
        </div>
      </form>
    </div>
  );
}

function AutomationStepCard({
  setting,
  disabled,
  onUpdate,
}: {
  setting: AutomationSetting;
  disabled: boolean;
  onUpdate: (patch: {
    stepNumber: 1 | 2 | 3;
    isActive?: boolean;
    targetGroup?: string;
    delayHours?: number;
    issuePromo?: boolean;
  }) => Promise<void>;
}) {
  const [targetGroup, setTargetGroup] = useState(setting.targetGroup);
  const [delayHours, setDelayHours] = useState(String(setting.delayHours));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setTargetGroup(setting.targetGroup);
    setDelayHours(String(setting.delayHours));
  }, [setting.delayHours, setting.targetGroup]);

  const handleTargetGroupChange = async (value: string) => {
    setTargetGroup(value as AutomationSetting["targetGroup"]);
    setIsSaving(true);

    try {
      await onUpdate({ stepNumber: setting.stepNumber, targetGroup: value });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelayHoursBlur = async () => {
    const parsed = Number.parseFloat(delayHours);

    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 720) {
      setDelayHours(String(setting.delayHours));
      return;
    }

    if (parsed === setting.delayHours) {
      return;
    }

    setIsSaving(true);

    try {
      await onUpdate({ stepNumber: setting.stepNumber, delayHours: parsed });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 p-4 dark:border-zinc-700/50">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-cream">
            {AUTOMATION_STEP_LABELS[setting.stepNumber]}
          </h3>
          <p className={`mt-1 text-sm ${ui.bodyMuted}`}>
            Sends after {setting.delayHours} hours of cart inactivity
          </p>
        </div>
        <ToggleSwitch
          id={`automation-step-${setting.stepNumber}`}
          checked={setting.isActive}
          onChange={(checked) =>
            void onUpdate({ stepNumber: setting.stepNumber, isActive: checked })
          }
          disabled={disabled || isSaving}
          label={setting.isActive ? "Active" : "Paused"}
        />
      </div>

      <label className="mt-4 block space-y-1.5">
        <AdminFieldLabel>Delay (hours after last cart activity)</AdminFieldLabel>
        <AdminInput
          type="number"
          min="0.5"
          max="720"
          step="0.5"
          value={delayHours}
          disabled={disabled || isSaving}
          onChange={(event) => setDelayHours(event.target.value)}
          onBlur={() => void handleDelayHoursBlur()}
        />
      </label>

      <label className="mt-4 block space-y-1.5">
        <AdminFieldLabel>Target group</AdminFieldLabel>
        <AdminSelect
          value={targetGroup}
          disabled={disabled || isSaving}
          onChange={(event) => void handleTargetGroupChange(event.target.value)}
        >
          {AUTOMATION_TARGET_GROUPS.map((group) => (
            <option key={group} value={group}>
              {group}
            </option>
          ))}
        </AdminSelect>
      </label>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 px-3 py-3 dark:border-zinc-700/50">
        <div>
          <p className="text-sm font-medium text-slate-900 dark:text-cream">Issue promo code</p>
          <p className={`mt-0.5 text-xs ${ui.bodyMuted}`}>
            Attach a personal coupon when this step sends (step 3 only by default).
          </p>
        </div>
        <ToggleSwitch
          id={`automation-step-promo-${setting.stepNumber}`}
          checked={setting.issuePromo}
          onChange={(checked) =>
            void onUpdate({ stepNumber: setting.stepNumber, issuePromo: checked })
          }
          disabled={disabled || isSaving}
          label={setting.issuePromo ? "On" : "Off"}
        />
      </div>
    </div>
  );
}

export default function AdminAbandonedCartsPage() {
  const [carts, setCarts] = useState<AbandonedCartListItem[]>([]);
  const [automationSettings, setAutomationSettings] = useState<AutomationSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingAutomation, setIsSavingAutomation] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCart, setSelectedCart] = useState<AbandonedCartDealerContext | null>(null);
  const [emailTarget, setEmailTarget] = useState<AbandonedCartListItem | null>(null);
  const [isLoadingCart, setIsLoadingCart] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/abandoned-carts");

      if (!response.ok) {
        throw new Error("Failed to load abandoned carts");
      }

      const data = (await response.json()) as {
        carts: AbandonedCartListItem[];
        automationSettings: AutomationSetting[];
      };

      setCarts(data.carts);
      setAutomationSettings(data.automationSettings);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load abandoned carts");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useDeferredEffect(() => {
    void loadData();
  }, [loadData]);

  const handleUpdateAutomationStep = async (patch: {
    stepNumber: 1 | 2 | 3;
    isActive?: boolean;
    targetGroup?: string;
    delayHours?: number;
    issuePromo?: boolean;
  }) => {
    setIsSavingAutomation(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/automation-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });

      const data = (await response.json()) as {
        setting?: AutomationSetting;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update automation step");
      }

      if (data.setting) {
        setAutomationSettings((current) =>
          current.map((entry) =>
            entry.stepNumber === data.setting!.stepNumber ? data.setting! : entry
          )
        );
      }

      setMessage(`Automation step ${patch.stepNumber} updated.`);
    } catch (updateError) {
      setError(
        updateError instanceof Error ? updateError.message : "Failed to update automation step"
      );
    } finally {
      setIsSavingAutomation(false);
    }
  };

  const openCartItems = async (userId: number) => {
    setIsLoadingCart(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/abandoned-carts/${userId}`);

      if (!response.ok) {
        throw new Error("Failed to load cart items");
      }

      const data = (await response.json()) as { cart: AbandonedCartDealerContext };
      setSelectedCart(data.cart);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load cart items");
    } finally {
      setIsLoadingCart(false);
    }
  };

  return (
    <AdminShell
      wide
      title="Abandoned Cart Recovery"
      subtitle="Track open dealer carts and manage automated reminder emails"
    >
      <AdminSectionNav variant="campaigns" />

      {message && <AdminAlert tone="success">{message}</AdminAlert>}
      {error && <AdminAlert tone="error">{error}</AdminAlert>}

      <section className={`mb-6 p-5 sm:p-6 ${ui.adminCard}`}>
        <div className="mb-5">
          <h2 className={ui.heading2}>Automated recovery steps</h2>
          <p className={`mt-1.5 ${ui.bodyMuted}`}>
            Enable or pause each reminder independently. Set how many hours after cart inactivity
            each step should send. If an email template for that step has its own delay hours, the
            template value takes priority.
          </p>
        </div>
        {isLoading ? (
          <LoadingState label="Loading automation settings..." minHeight="min-h-[120px]" />
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {automationSettings.map((setting) => (
              <AutomationStepCard
                key={setting.stepNumber}
                setting={setting}
                disabled={isSavingAutomation}
                onUpdate={handleUpdateAutomationStep}
              />
            ))}
          </div>
        )}
      </section>

      {isLoading ? (
        <LoadingState label="Loading abandoned carts..." minHeight="min-h-[320px]" spinnerSize="lg" />
      ) : carts.length === 0 ? (
        <div className={`px-6 py-16 text-center ${ui.emptyState}`}>
          <p className="text-slate-600 dark:text-cream/80">No active abandoned carts right now.</p>
        </div>
      ) : (
        <div className={`overflow-hidden ${ui.adminCard}`}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className={ui.tableHead}>
                <tr>
                  <th className={ui.tableHeadCell}>Dealer</th>
                  <th className={ui.tableHeadCell}>Company</th>
                  <th className={ui.tableHeadCell}>Cart total</th>
                  <th className={ui.tableHeadCell}>Last active</th>
                  <th className={ui.tableHeadCell}>Email status</th>
                  <th className={ui.tableHeadCell}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {carts.map((cart) => (
                  <tr key={cart.userId} className={ui.tableRow}>
                    <td className={ui.tableCell}>
                      <p className="font-semibold text-slate-900 dark:text-cream">
                        {cart.contactName || "—"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-cream/60">{cart.email}</p>
                    </td>
                    <td className={`${ui.tableCell} text-slate-600 dark:text-cream/75`}>
                      {cart.companyName || "—"}
                    </td>
                    <td className={`${ui.tableCell} font-semibold text-slate-900 dark:text-cream`}>
                      {formatPrice(cart.cartTotal)}
                      <p className="mt-1 text-xs font-normal text-slate-500 dark:text-cream/60">
                        {cart.itemCount} item{cart.itemCount === 1 ? "" : "s"}
                      </p>
                    </td>
                    <td className={`${ui.tableCell} text-slate-600 dark:text-cream/75`}>
                      {formatDate(cart.lastActiveAt)}
                    </td>
                    <td className={ui.tableCell}>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-zinc-700/50 dark:bg-navy-hover dark:text-cream/85">
                        {ABANDONED_MAIL_STATUS_LABELS[cart.mailStatus]}
                      </span>
                    </td>
                    <td className={ui.tableCell}>
                      <div className="flex flex-wrap gap-2">
                        <AdminButton
                          type="button"
                          disabled={isLoadingCart}
                          onClick={() => void openCartItems(cart.userId)}
                        >
                          View cart items
                        </AdminButton>
                        <AdminButton
                          type="button"
                          variant="primary"
                          aria-label={`Send email to ${cart.contactName || cart.email}`}
                          onClick={() => setEmailTarget(cart)}
                        >
                          <span className="inline-flex items-center gap-2">
                            <MailIcon size={16} />
                            Send email
                          </span>
                        </AdminButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedCart && (
        <CartItemsModal cart={selectedCart} onClose={() => setSelectedCart(null)} />
      )}

      {emailTarget && (
        <SendTemplateEmailModal
          cart={emailTarget}
          onClose={() => setEmailTarget(null)}
          onSent={(successMessage) => {
            setMessage(successMessage);
            void loadData();
          }}
        />
      )}
    </AdminShell>
  );
}
