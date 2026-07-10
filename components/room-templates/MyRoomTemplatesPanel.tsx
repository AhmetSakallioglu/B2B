"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { CustomerAccountNav } from "@/components/account/CustomerAccountNav";
import { LoadingState } from "@/components/ui/LoadingState";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { GridIcon, ShoppingCartIcon, TrashIcon } from "@/components/ui/Icon";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { formatDate } from "@/lib/order-display";
import {
  ROOM_TEMPLATE_MULTIPLIER_MAX,
  ROOM_TEMPLATE_MULTIPLIER_MIN,
} from "@/lib/room-template-validation";
import { ui } from "@/lib/ui-classes";
import { useCartStore } from "@/store/useCartStore";
import type { OrderCartItem } from "@/types/catalog";
import type { RoomTemplateDetail, RoomTemplateSummary } from "@/types/room-templates";

export function MyRoomTemplatesPanel() {
  const router = useRouter();
  const { confirm } = useConfirm();
  const setItems = useCartStore((state) => state.setItems);
  const [templates, setTemplates] = useState<RoomTemplateSummary[]>([]);
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<RoomTemplateDetail["items"]>([]);
  const [multipliers, setMultipliers] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState<string | null>(null);
  const [isAddingTemplateId, setIsAddingTemplateId] = useState<string | null>(null);
  const [isDeletingTemplateId, setIsDeletingTemplateId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/templates");

      if (response.status === 401) {
        router.replace("/login?redirect=/account/room-templates");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to load room templates");
      }

      const data = (await response.json()) as { templates: RoomTemplateSummary[] };
      setTemplates(data.templates);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load room templates");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useDeferredEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const loadTemplateDetail = async (templateId: string) => {
    if (expandedTemplateId === templateId) {
      setExpandedTemplateId(null);
      setExpandedItems([]);
      return;
    }

    setIsLoadingDetail(templateId);
    setError(null);

    try {
      const response = await fetch(`/api/templates/${templateId}`);

      if (!response.ok) {
        throw new Error("Failed to load template details");
      }

      const data = (await response.json()) as { template: RoomTemplateDetail };
      setExpandedTemplateId(templateId);
      setExpandedItems(data.template.items);
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : "Failed to load template");
    } finally {
      setIsLoadingDetail(null);
    }
  };

  const readMultiplier = (templateId: string) => {
    const raw = multipliers[templateId] ?? "1";
    const parsed = Number.parseInt(raw, 10);

    if (!Number.isInteger(parsed)) {
      return ROOM_TEMPLATE_MULTIPLIER_MIN;
    }

    return Math.min(
      Math.max(parsed, ROOM_TEMPLATE_MULTIPLIER_MIN),
      ROOM_TEMPLATE_MULTIPLIER_MAX
    );
  };

  const addTemplateToCart = async (template: RoomTemplateSummary) => {
    const multiplier = readMultiplier(template.id);

    setIsAddingTemplateId(template.id);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/templates/${template.id}/add-to-cart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ multiplier }),
      });

      const data = (await response.json()) as {
        error?: string;
        items?: OrderCartItem[];
        templateName?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to add template to cart");
      }

      if (data.items) {
        setItems(data.items);
      }

      router.push("/cart");
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "Failed to add template to cart");
    } finally {
      setIsAddingTemplateId(null);
    }
  };

  const deleteTemplate = async (template: RoomTemplateSummary) => {
    const confirmed = await confirm({
      title: "Delete room template?",
      description: `Remove "${template.templateName}" from your saved templates? This cannot be undone.`,
      confirmLabel: "Delete template",
      tone: "danger",
    });

    if (!confirmed) {
      return;
    }

    setIsDeletingTemplateId(template.id);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/templates/${template.id}`, {
        method: "DELETE",
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to delete template");
      }

      setTemplates((current) => current.filter((entry) => entry.id !== template.id));

      if (expandedTemplateId === template.id) {
        setExpandedTemplateId(null);
        setExpandedItems([]);
      }

      setMessage(`Template "${template.templateName}" deleted.`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete template");
    } finally {
      setIsDeletingTemplateId(null);
    }
  };

  return (
    <div className={ui.catalogPageBg}>
      <header className={ui.adminHeaderBar}>
        <div className={`${ui.pageContainerNarrow} py-4`}>
          <div>
            <p className={ui.eyebrow}>Account</p>
            <h1 className={`mt-2 flex items-center gap-2 ${ui.heading1}`}>
              <GridIcon size={26} className="text-brand" />
              My Room Templates
            </h1>
            <p className={`mt-1 ${ui.bodyMuted}`}>
              Reuse saved cabinet packages across units. Enter a project multiplier to bulk-add
              cabinets to your cart in one click.
            </p>
          </div>
          <div className="mt-5">
            <CustomerAccountNav active="room-templates" />
          </div>
        </div>
      </header>

      <main className={`${ui.pageContainerNarrow} py-8 ${ui.sectionStack}`}>
        {isLoading ? (
          <LoadingState
            label="Loading your room templates..."
            minHeight="min-h-[240px]"
            spinnerSize="lg"
          />
        ) : error && templates.length === 0 ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center dark:border-red-900/40 dark:bg-red-950/30">
            <p className="text-red-700 dark:text-red-300">{error}</p>
            <button type="button" onClick={() => void loadTemplates()} className={`mt-4 ${ui.btnPrimary}`}>
              Retry
            </button>
          </div>
        ) : templates.length === 0 ? (
          <div className={`px-6 py-12 text-center ${ui.emptyState}`}>
            <GridIcon size={40} className="mx-auto text-slate-300" />
            <p className="mt-4 text-base font-semibold text-slate-900 dark:text-cream">
              No room templates yet
            </p>
            <p className={`mt-2 ${ui.bodyMuted}`}>
              Build a cart layout, then use Save Cart as Room Template to store it for future
              projects.
            </p>
            <Link href="/cart" className={`mt-4 inline-flex ${ui.btnPrimary}`}>
              <ShoppingCartIcon size={15} />
              Go to cart
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {message && <p className={`px-4 py-3 text-sm ${ui.cardMuted}`}>{message}</p>}
            {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}

            {templates.map((template) => {
              const isExpanded = expandedTemplateId === template.id;

              return (
                <article key={template.id} className={`overflow-hidden ${ui.catalogCard}`}>
                  <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg font-semibold text-slate-950 dark:text-cream">
                        {template.templateName}
                      </h2>
                      <p className={`mt-1 text-sm ${ui.bodyMuted}`}>
                        {template.lineCount} cabinet line{template.lineCount === 1 ? "" : "s"} ·{" "}
                        {template.totalQuantity} base unit
                        {template.totalQuantity === 1 ? "" : "s"} · Saved {formatDate(template.createdAt)}
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end lg:justify-end">
                      <label className="block min-w-[140px] space-y-1.5">
                        <span className={ui.fieldLabel}>Units / multiplier</span>
                        <input
                          type="number"
                          min={ROOM_TEMPLATE_MULTIPLIER_MIN}
                          max={ROOM_TEMPLATE_MULTIPLIER_MAX}
                          value={multipliers[template.id] ?? "1"}
                          onChange={(event) =>
                            setMultipliers((current) => ({
                              ...current,
                              [template.id]: event.target.value,
                            }))
                          }
                          className={`${ui.input} w-full`}
                        />
                      </label>

                      <button
                        type="button"
                        disabled={isAddingTemplateId === template.id || isDeletingTemplateId === template.id}
                        onClick={() => void addTemplateToCart(template)}
                        className={`${ui.btnPrimary} w-full sm:w-auto`}
                      >
                        {isAddingTemplateId === template.id ? "Adding..." : "Add to Cart"}
                      </button>

                      <button
                        type="button"
                        disabled={isLoadingDetail === template.id}
                        onClick={() => void loadTemplateDetail(template.id)}
                        className={`${ui.btnSecondary} w-full sm:w-auto`}
                      >
                        {isLoadingDetail === template.id
                          ? "Loading..."
                          : isExpanded
                            ? "Hide contents"
                            : "View contents"}
                      </button>

                      <button
                        type="button"
                        disabled={isDeletingTemplateId === template.id || isAddingTemplateId === template.id}
                        onClick={() => void deleteTemplate(template)}
                        className={`${ui.btnGhost} w-full text-red-700 sm:w-auto dark:text-red-300`}
                      >
                        <TrashIcon size={15} />
                        {isDeletingTemplateId === template.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-200/80 px-5 py-4 dark:border-zinc-700/50">
                      <p className={`mb-3 text-xs font-semibold uppercase tracking-wide ${ui.bodyMuted}`}>
                        Template contents
                      </p>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-slate-200/80 dark:border-zinc-700/50">
                              <th className="px-2 py-2 font-semibold text-slate-700 dark:text-cream/80">
                                Cabinet code
                              </th>
                              <th className="px-2 py-2 font-semibold text-slate-700 dark:text-cream/80">
                                Base qty
                              </th>
                              <th className="px-2 py-2 font-semibold text-slate-700 dark:text-cream/80">
                                With multiplier
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {expandedItems.map((item) => {
                              const multiplied = item.quantity * readMultiplier(template.id);

                              return (
                                <tr
                                  key={`${template.id}-${item.variant_id}`}
                                  className="border-b border-slate-100 dark:border-zinc-800/80"
                                >
                                  <td className="px-2 py-2 font-medium text-slate-900 dark:text-cream">
                                    {item.cabinet_code}
                                  </td>
                                  <td className="px-2 py-2 text-slate-700 dark:text-cream/80">
                                    {item.quantity}
                                  </td>
                                  <td className="px-2 py-2 font-semibold text-brand">
                                    {multiplied}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
