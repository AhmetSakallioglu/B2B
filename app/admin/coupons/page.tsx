"use client";

import Link from "next/link";
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
} from "@/components/admin/admin-ui";
import { AdminSectionNav } from "@/components/admin/AdminOrdersSubNav";
import { EmailTemplateVariablesReference } from "@/components/admin/EmailTemplateVariablesReference";
import { AdminShell } from "@/components/admin/AdminShell";
import { LoadingState } from "@/components/ui/LoadingState";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { formatDate } from "@/lib/order-display";
import { ui } from "@/lib/ui-classes";
import type { DealerGroup } from "@/types/dealer-group";
import type { PromoCode } from "@/types/promo-code";
import {
  createEmptyAdminPermissions,
  hasAdminPermission,
  type AdminPermissions,
} from "@/types/admin-permissions";
import type { GroupPromoRate, UserGroupTag } from "@/types/user-segmentation";
import { USER_GROUP_TAGS } from "@/types/user-segmentation";

type DealerOption = {
  id: number;
  email: string;
  label: string;
  groupTag: string;
  accountStatus: string;
};

type PromoCodeListItem = PromoCode & {
  userEmail: string;
  companyName: string | null;
};

type ManualCouponTargetType = "dealer" | "group";

export default function AdminCouponsPage() {
  const { confirm } = useConfirm();
  const [permissions, setPermissions] = useState<AdminPermissions>(createEmptyAdminPermissions());
  const [promoCodes, setPromoCodes] = useState<PromoCodeListItem[]>([]);
  const [groupRates, setGroupRates] = useState<GroupPromoRate[]>([]);
  const [customers, setCustomers] = useState<DealerOption[]>([]);
  const [dealerGroups, setDealerGroups] = useState<DealerGroup[]>([]);
  const [automaticCouponsEnabled, setAutomaticCouponsEnabled] = useState(true);
  const [promoExpiryDays, setPromoExpiryDays] = useState("7");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [isSavingRates, setIsSavingRates] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualForm, setManualForm] = useState({
    targetType: "dealer" as ManualCouponTargetType,
    userId: "",
    dealerGroupId: "",
    discountValue: "5",
    expiryDays: "7",
  });
  const [rateDrafts, setRateDrafts] = useState<Record<UserGroupTag, string>>({
    "Tier 1": "3",
    "Tier 2": "5",
    New: "5",
    Inactive: "8",
  });
  const [rateActiveDrafts, setRateActiveDrafts] = useState<Record<UserGroupTag, boolean>>({
    "Tier 1": true,
    "Tier 2": true,
    New: true,
    Inactive: true,
  });

  const [isSavingPromoAction, setIsSavingPromoAction] = useState<string | null>(null);

  const canManageCoupons = hasAdminPermission(permissions, "can_manage_coupons");
  const canToggleCoupons = hasAdminPermission(permissions, "can_toggle_coupons");
  const canDeleteCoupons = hasAdminPermission(permissions, "can_delete_coupons");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [response, meResponse] = await Promise.all([
        fetch("/api/admin/coupons"),
        fetch("/api/auth/me"),
      ]);

      if (meResponse.ok) {
        const meData = (await meResponse.json()) as { permissions?: AdminPermissions };
        setPermissions(meData.permissions ?? createEmptyAdminPermissions());
      }

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to load coupon settings");
      }

      const data = (await response.json()) as {
        promoCodes: PromoCodeListItem[];
        groupRates: GroupPromoRate[];
        customers: DealerOption[];
        dealerGroups: DealerGroup[];
        automaticCouponsEnabled: boolean;
        promoExpiryDays: number;
      };

      setPromoCodes(data.promoCodes);
      setGroupRates(data.groupRates);
      setCustomers(data.customers);
      setDealerGroups(data.dealerGroups);
      setAutomaticCouponsEnabled(data.automaticCouponsEnabled);
      setPromoExpiryDays(String(data.promoExpiryDays));
      setManualForm((current) => ({
        ...current,
        expiryDays: String(data.promoExpiryDays),
      }));
      setRateDrafts(
        Object.fromEntries(
          USER_GROUP_TAGS.map((groupTag) => {
            const rate = data.groupRates.find((entry) => entry.groupTag === groupTag);
            return [groupTag, String(rate?.discountPercentage ?? 5)];
          })
        ) as Record<UserGroupTag, string>
      );
      setRateActiveDrafts(
        Object.fromEntries(
          USER_GROUP_TAGS.map((groupTag) => {
            const rate = data.groupRates.find((entry) => entry.groupTag === groupTag);
            return [groupTag, rate?.isActive ?? true];
          })
        ) as Record<UserGroupTag, boolean>
      );

      if (data.customers.length > 0) {
        setManualForm((current) =>
          current.userId
            ? current
            : { ...current, userId: String(data.customers[0]!.id) }
        );
      }

      if (data.dealerGroups.length > 0) {
        setManualForm((current) =>
          current.dealerGroupId
            ? current
            : { ...current, dealerGroupId: String(data.dealerGroups[0]!.id) }
        );
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load coupon settings");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useDeferredEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreateManualCoupon = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSavingManual(true);
    setMessage(null);
    setError(null);

    try {
      const payload =
        manualForm.targetType === "group"
          ? {
              targetType: "group" as const,
              dealerGroupId: Number.parseInt(manualForm.dealerGroupId, 10),
              discountValue: Number.parseFloat(manualForm.discountValue),
              expiryDays: Number.parseInt(manualForm.expiryDays, 10),
            }
          : {
              targetType: "dealer" as const,
              userId: Number.parseInt(manualForm.userId, 10),
              discountValue: Number.parseFloat(manualForm.discountValue),
              expiryDays: Number.parseInt(manualForm.expiryDays, 10),
            };

      const response = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as {
        error?: string;
        promo?: PromoCode;
        created?: number;
        failed?: number;
        targetType?: ManualCouponTargetType;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to create manual coupon");
      }

      if (data.targetType === "group") {
        const failedNote =
          data.failed && data.failed > 0 ? ` ${data.failed} failed.` : "";
        setMessage(`Created ${data.created ?? 0} coupons for the selected group.${failedNote}`);
      } else {
        setMessage(`Manual coupon ${data.promo?.code ?? ""} created successfully.`);
      }
      setManualForm((current) => ({
        ...current,
        discountValue: "5",
        expiryDays: promoExpiryDays,
      }));
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to create manual coupon");
    } finally {
      setIsSavingManual(false);
    }
  };

  const handleSaveGroupRates = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSavingRates(true);
    setMessage(null);
    setError(null);

    const groupRatesPayload = USER_GROUP_TAGS.map((groupTag) => ({
      groupTag,
      discountPercentage: Number.parseFloat(rateDrafts[groupTag]),
      isActive: rateActiveDrafts[groupTag],
    }));

    try {
      const response = await fetch("/api/admin/coupons", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupRates: groupRatesPayload,
          automaticCouponsEnabled,
          promoExpiryDays: Number.parseInt(promoExpiryDays, 10),
        }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update group rates");
      }

      setMessage("Automatic coupon settings updated.");
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to update group rates");
    } finally {
      setIsSavingRates(false);
    }
  };

  const handleTogglePromo = async (promo: PromoCodeListItem, isActive: boolean) => {
    setIsSavingPromoAction(promo.id);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/admin/coupons/${promo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update coupon");
      }

      setMessage(isActive ? `Coupon ${promo.code} reactivated.` : `Coupon ${promo.code} deactivated.`);
      await loadData();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Failed to update coupon");
    } finally {
      setIsSavingPromoAction(null);
    }
  };

  const handleDeletePromo = async (promo: PromoCodeListItem) => {
    const confirmed = await confirm({
      title: "Delete coupon",
      description: `Permanently delete unused coupon ${promo.code}? This cannot be undone.`,
      confirmLabel: "Delete",
      tone: "danger",
    });

    if (!confirmed) {
      return;
    }

    setIsSavingPromoAction(promo.id);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/admin/coupons/${promo.id}`, {
        method: "DELETE",
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to delete coupon");
      }

      setMessage(`Coupon ${promo.code} deleted.`);
      await loadData();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete coupon");
    } finally {
      setIsSavingPromoAction(null);
    }
  };

  const isPromoExpired = (expiresAt: string) => new Date(expiresAt).getTime() <= Date.now();

  return (
    <AdminShell
      wide
      title="Coupons"
      subtitle="Create manual promo codes and configure automatic recovery discounts by dealer group"
    >
      <AdminSectionNav variant="campaigns" />

      {message && <AdminAlert tone="success">{message}</AdminAlert>}
      {error && <AdminAlert tone="error">{error}</AdminAlert>}

      {isLoading ? (
        <LoadingState label="Loading coupon settings..." minHeight="min-h-[320px]" spinnerSize="lg" />
      ) : (
        <div className="space-y-6">
          {(canManageCoupons || canToggleCoupons || canDeleteCoupons) && (
            <>
              {canManageCoupons && (
                <div className="grid gap-6 xl:grid-cols-2">
                  <AdminPanel>
              <h2 className={ui.heading2}>Create manual coupon</h2>
              <p className={`mt-2 text-sm ${ui.bodyMuted}`}>
                Issue one-time promo codes for a single dealer or every member of a recipient
                group.
              </p>
              <form onSubmit={handleCreateManualCoupon} className="mt-6 space-y-4">
                <fieldset className="space-y-3">
                  <legend className={ui.fieldLabel}>Issue to</legend>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800 dark:text-cream">
                      <input
                        type="radio"
                        name="manual-coupon-target"
                        value="dealer"
                        checked={manualForm.targetType === "dealer"}
                        onChange={() =>
                          setManualForm((current) => ({ ...current, targetType: "dealer" }))
                        }
                        className="h-4 w-4 accent-copper"
                      />
                      Single dealer
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800 dark:text-cream">
                      <input
                        type="radio"
                        name="manual-coupon-target"
                        value="group"
                        checked={manualForm.targetType === "group"}
                        onChange={() =>
                          setManualForm((current) => ({ ...current, targetType: "group" }))
                        }
                        className="h-4 w-4 accent-copper"
                      />
                      Recipient group
                    </label>
                  </div>
                </fieldset>

                {manualForm.targetType === "dealer" ? (
                  <label className="block space-y-1.5">
                    <AdminFieldLabel>Dealer</AdminFieldLabel>
                    {customers.length === 0 ? (
                      <AdminAlert tone="error">
                        No dealer accounts found. Approve dealers under{" "}
                        <Link href="/admin/users" className="font-semibold underline">
                          Users
                        </Link>{" "}
                        first.
                      </AdminAlert>
                    ) : (
                      <AdminSelect
                        required
                        value={manualForm.userId}
                        onChange={(event) =>
                          setManualForm((current) => ({ ...current, userId: event.target.value }))
                        }
                      >
                        <option value="">Select a dealer</option>
                        {customers.map((customer) => (
                          <option key={customer.id} value={customer.id}>
                            {customer.label}
                          </option>
                        ))}
                      </AdminSelect>
                    )}
                  </label>
                ) : (
                  <label className="block space-y-1.5">
                    <AdminFieldLabel>Recipient group</AdminFieldLabel>
                    {dealerGroups.length === 0 ? (
                      <AdminAlert tone="error">
                        No recipient groups yet. Create one under{" "}
                        <Link href="/admin/settings/recipient-groups" className="font-semibold underline">
                          Recipient groups
                        </Link>
                        .
                      </AdminAlert>
                    ) : (
                      <>
                        <AdminSelect
                          required
                          value={manualForm.dealerGroupId}
                          onChange={(event) =>
                            setManualForm((current) => ({
                              ...current,
                              dealerGroupId: event.target.value,
                            }))
                          }
                        >
                          <option value="">Select a group</option>
                          {dealerGroups.map((group) => (
                            <option key={group.id} value={group.id}>
                              {group.name} ({group.memberCount} members)
                            </option>
                          ))}
                        </AdminSelect>
                        <p className={`text-xs ${ui.bodyMuted}`}>
                          Creates a unique coupon for each member in the group.
                        </p>
                      </>
                    )}
                  </label>
                )}
                <label className="block space-y-1.5">
                  <AdminFieldLabel>Discount percentage</AdminFieldLabel>
                  <AdminInput
                    required
                    type="number"
                    min="0.01"
                    max="100"
                    step="0.01"
                    value={manualForm.discountValue}
                    onChange={(event) =>
                      setManualForm((current) => ({
                        ...current,
                        discountValue: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="block space-y-1.5">
                  <AdminFieldLabel>Valid for (days)</AdminFieldLabel>
                  <AdminInput
                    required
                    type="number"
                    min="1"
                    max="365"
                    step="1"
                    value={manualForm.expiryDays}
                    onChange={(event) =>
                      setManualForm((current) => ({
                        ...current,
                        expiryDays: event.target.value,
                      }))
                    }
                  />
                </label>
                <AdminButton
                  type="submit"
                  variant="primary"
                  disabled={
                    isSavingManual ||
                    (manualForm.targetType === "dealer"
                      ? customers.length === 0
                      : dealerGroups.length === 0)
                  }
                >
                  {isSavingManual
                    ? "Creating..."
                    : manualForm.targetType === "group"
                      ? "Create coupons for group"
                      : "Create manual coupon"}
                </AdminButton>
              </form>
            </AdminPanel>

            <AdminPanel>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className={ui.heading2}>Automatic coupon settings</h2>
                  <p className={`mt-2 text-sm ${ui.bodyMuted}`}>
                    Control automatic promo code issuance during Step 3 recovery emails.
                  </p>
                </div>
                <ToggleSwitch
                  id="automatic-coupons-enabled"
                  checked={automaticCouponsEnabled}
                  onChange={setAutomaticCouponsEnabled}
                  label={automaticCouponsEnabled ? "Enabled" : "Disabled"}
                />
              </div>
              <form onSubmit={handleSaveGroupRates} className="mt-6 space-y-4">
                <label className="block space-y-1.5">
                  <AdminFieldLabel>Default coupon validity (days)</AdminFieldLabel>
                  <AdminInput
                    required
                    type="number"
                    min="1"
                    max="365"
                    step="1"
                    className="max-w-xs"
                    value={promoExpiryDays}
                    onChange={(event) => setPromoExpiryDays(event.target.value)}
                  />
                  <p className={`text-xs ${ui.bodyMuted}`}>
                    Used for automatic recovery, bulk email, and manual coupons unless overridden.
                  </p>
                </label>
                {USER_GROUP_TAGS.map((groupTag) => (
                  <div key={groupTag} className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <ToggleSwitch
                        id={`rate-active-${groupTag}`}
                        checked={rateActiveDrafts[groupTag]}
                        onChange={(checked) =>
                          setRateActiveDrafts((current) => ({ ...current, [groupTag]: checked }))
                        }
                        label={groupTag}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <AdminInput
                        required
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        className="w-28"
                        disabled={!rateActiveDrafts[groupTag]}
                        value={rateDrafts[groupTag]}
                        onChange={(event) =>
                          setRateDrafts((current) => ({
                            ...current,
                            [groupTag]: event.target.value,
                          }))
                        }
                      />
                      <span className="text-sm text-slate-500 dark:text-cream/60">%</span>
                    </div>
                  </div>
                ))}
                <AdminButton type="submit" variant="primary" disabled={isSavingRates}>
                  {isSavingRates ? "Saving..." : "Save automatic settings"}
                </AdminButton>
              </form>
            </AdminPanel>
                </div>
              )}
            </>
          )}

          <AdminPanel>
            <h2 className={ui.heading2}>Recent promo codes</h2>
            {promoCodes.length === 0 ? (
              <p className={`mt-4 text-sm ${ui.bodyMuted}`}>No promo codes have been issued yet.</p>
            ) : (
              <AdminListStack>
                {promoCodes.map((promo) => {
                  const expired = isPromoExpired(promo.expiresAt);
                  const isBusy = isSavingPromoAction === promo.id;

                  return (
                  <AdminListCard key={promo.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-navy dark:text-cream">{promo.code}</p>
                          <AdminBadge tone={promo.creationType === "MANUAL" ? "brand" : "neutral"}>
                            {promo.creationType}
                          </AdminBadge>
                          {promo.isUsed && <AdminBadge tone="success">Used</AdminBadge>}
                          {!promo.isActive && !promo.isUsed && (
                            <AdminBadge tone="danger">Inactive</AdminBadge>
                          )}
                          {expired && !promo.isUsed && (
                            <AdminBadge tone="neutral">Expired</AdminBadge>
                          )}
                        </div>
                        <p className={`mt-2 text-sm ${ui.bodyMuted}`}>
                          {promo.companyName || promo.userEmail} · {promo.discountValue}% off ·
                          expires {formatDate(promo.expiresAt)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-3">
                        <p className="text-xs text-slate-500 dark:text-cream/60">
                          Created {formatDate(promo.createdAt)}
                        </p>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {canToggleCoupons && !promo.isUsed && (
                            <ToggleSwitch
                              id={`promo-active-${promo.id}`}
                              checked={promo.isActive}
                              disabled={isBusy}
                              onChange={(checked) => void handleTogglePromo(promo, checked)}
                              label={promo.isActive ? "Active" : "Inactive"}
                            />
                          )}
                          {canDeleteCoupons && !promo.isUsed && (
                            <AdminButton
                              type="button"
                              variant="secondary"
                              disabled={isBusy}
                              onClick={() => void handleDeletePromo(promo)}
                            >
                              Delete
                            </AdminButton>
                          )}
                        </div>
                      </div>
                    </div>
                  </AdminListCard>
                  );
                })}
              </AdminListStack>
            )}
          </AdminPanel>

          {canManageCoupons && (
            <EmailTemplateVariablesReference
              mode="coupons"
              defaultPromoExpiryDays={Number.parseInt(promoExpiryDays, 10) || 7}
            />
          )}
        </div>
      )}
    </AdminShell>
  );
}
