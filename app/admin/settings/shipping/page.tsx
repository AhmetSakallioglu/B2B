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
import { formatPrice } from "@/lib/order-display";
import { ui } from "@/lib/ui-classes";
import type { ShippingSettings, ShippingZone } from "@/types/shipping-zone";

export default function AdminShippingSettingsPage() {
  const { confirm } = useConfirm();
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [settings, setSettings] = useState<ShippingSettings>({ defaultOutOfZoneRate: 500 });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [zoneName, setZoneName] = useState("");
  const [basePrice, setBasePrice] = useState("150");
  const [zipCodes, setZipCodes] = useState("");
  const [freeShippingThreshold, setFreeShippingThreshold] = useState("");
  const [defaultOutOfZoneRate, setDefaultOutOfZoneRate] = useState("500");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/shipping-zones");

      if (!response.ok) {
        throw new Error("Failed to load shipping zones");
      }

      const data = (await response.json()) as {
        zones: ShippingZone[];
        settings: ShippingSettings;
      };

      setZones(data.zones);
      setSettings(data.settings);
      setDefaultOutOfZoneRate(String(data.settings.defaultOutOfZoneRate));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load shipping zones");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useDeferredEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreateZone = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/shipping-zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zoneName,
          basePrice: Number.parseFloat(basePrice),
          zipCodes,
          freeShippingThreshold: freeShippingThreshold.trim()
            ? Number.parseFloat(freeShippingThreshold)
            : null,
        }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to create shipping zone");
      }

      setMessage(`Shipping zone "${zoneName}" created.`);
      setZoneName("");
      setBasePrice("150");
      setZipCodes("");
      setFreeShippingThreshold("");
      await loadData();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create zone");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/shipping-zones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultOutOfZoneRate: Number.parseFloat(defaultOutOfZoneRate),
        }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update default shipping rate");
      }

      setMessage("Default out-of-zone shipping rate updated.");
      await loadData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteZone = async (zone: ShippingZone) => {
    const confirmed = await confirm({
      title: `Delete "${zone.zoneName}"?`,
      description: "Dealers in these ZIP codes will fall back to the default out-of-zone rate.",
      confirmLabel: "Delete zone",
      cancelLabel: "Keep zone",
      tone: "danger",
    });

    if (!confirmed) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/shipping-zones", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zoneId: zone.id }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to delete shipping zone");
      }

      setMessage(`Shipping zone "${zone.zoneName}" deleted.`);
      await loadData();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete zone");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminShell
      wide
      title="Shipping Zones"
      subtitle="Configure ZIP-based delivery rates and free-shipping thresholds"
    >
      <AdminSectionNav variant="campaigns" />

      {message && <AdminAlert tone="success">{message}</AdminAlert>}
      {error && <AdminAlert tone="error">{error}</AdminAlert>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-6">
          <AdminPanel>
            <h2 className={ui.heading2}>Add new shipping zone</h2>
            <p className={`mt-2 text-sm ${ui.bodyMuted}`}>
              Enter ZIP codes separated by commas. Each ZIP can belong to only one zone.
            </p>
            <form onSubmit={handleCreateZone} className="mt-6 space-y-4">
              <label className="block space-y-1.5">
                <AdminFieldLabel>Zone name</AdminFieldLabel>
                <AdminInput
                  required
                  value={zoneName}
                  onChange={(event) => setZoneName(event.target.value)}
                  placeholder="Austin Downtown / West Campus"
                />
              </label>
              <label className="block space-y-1.5">
                <AdminFieldLabel>Base shipping price (USD)</AdminFieldLabel>
                <AdminInput
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={basePrice}
                  onChange={(event) => setBasePrice(event.target.value)}
                />
              </label>
              <label className="block space-y-1.5">
                <AdminFieldLabel>ZIP codes</AdminFieldLabel>
                <AdminInput
                  required
                  value={zipCodes}
                  onChange={(event) => setZipCodes(event.target.value)}
                  placeholder="78705, 78701, 78751"
                />
              </label>
              <label className="block space-y-1.5">
                <AdminFieldLabel>Free shipping threshold (optional)</AdminFieldLabel>
                <AdminInput
                  type="number"
                  min="0"
                  step="0.01"
                  value={freeShippingThreshold}
                  onChange={(event) => setFreeShippingThreshold(event.target.value)}
                  placeholder="5000"
                />
              </label>
              <AdminButton type="submit" variant="primary" disabled={isSaving}>
                Add shipping zone
              </AdminButton>
            </form>
          </AdminPanel>

          <AdminPanel>
            <h2 className={ui.heading2}>Out-of-zone fallback</h2>
            <p className={`mt-2 text-sm ${ui.bodyMuted}`}>
              Applied when a delivery ZIP is not listed in any zone. Checkout also shows a contact
              notice for custom quotes.
            </p>
            <form onSubmit={handleSaveSettings} className="mt-6 space-y-4">
              <label className="block space-y-1.5">
                <AdminFieldLabel>Default flat rate (USD)</AdminFieldLabel>
                <AdminInput
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={defaultOutOfZoneRate}
                  onChange={(event) => setDefaultOutOfZoneRate(event.target.value)}
                />
              </label>
              <p className={`text-xs ${ui.bodyMuted}`}>
                Current saved rate: {formatPrice(settings.defaultOutOfZoneRate)}
              </p>
              <AdminButton type="submit" variant="secondary" disabled={isSaving}>
                Save default rate
              </AdminButton>
            </form>
          </AdminPanel>
        </div>

        <AdminPanel>
          <h2 className={ui.heading2}>Existing zones</h2>
          {isLoading ? (
            <LoadingState label="Loading shipping zones..." minHeight="min-h-[200px]" />
          ) : zones.length === 0 ? (
            <p className={`mt-4 text-sm ${ui.bodyMuted}`}>No shipping zones configured yet.</p>
          ) : (
            <AdminListStack>
              {zones.map((zone) => (
                <AdminListCard key={zone.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-navy dark:text-cream">{zone.zoneName}</p>
                      <p className={`mt-1 text-sm ${ui.bodyMuted}`}>
                        Base rate: {formatPrice(zone.basePrice)}
                        {zone.freeShippingThreshold !== null && (
                          <> · Free over {formatPrice(zone.freeShippingThreshold)}</>
                        )}
                      </p>
                      <p className={`mt-2 text-xs ${ui.bodyMuted}`}>
                        ZIP codes: {zone.zipCodes.join(", ")}
                      </p>
                    </div>
                    <AdminButton
                      type="button"
                      variant="danger"
                      disabled={isSaving}
                      onClick={() => void handleDeleteZone(zone)}
                    >
                      Delete
                    </AdminButton>
                  </div>
                </AdminListCard>
              ))}
            </AdminListStack>
          )}
        </AdminPanel>
      </div>
    </AdminShell>
  );
}
