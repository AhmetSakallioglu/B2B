"use client";

import { ProductImageManager, type PendingImage } from "@/components/admin/ProductImageManager";
import { ui } from "@/lib/ui-classes";

type FinishOption = {
  id: number;
  name: string;
};

type ProductImagesByFinishProps = {
  finishes: FinishOption[];
  productId?: number;
  disabled?: boolean;
  activeFinishId?: number;
  onPendingChange?: (finishId: number, images: PendingImage[]) => void;
};

export function ProductImagesByFinish({
  finishes,
  productId,
  disabled = false,
  activeFinishId,
  onPendingChange,
}: ProductImagesByFinishProps) {
  const visibleFinishes = activeFinishId
    ? finishes.filter((finish) => finish.id === activeFinishId)
    : finishes;

  if (visibleFinishes.length === 0) {
    return (
      <p className={ui.bodyMuted}>
        {activeFinishId
          ? "Could not load images for this finish."
          : "Select at least one finish to manage images."}
      </p>
    );
  }

  const singleFinishMode = activeFinishId !== undefined;
  const activeFinishName = visibleFinishes[0]?.name;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-cream">
          {singleFinishMode ? "Product images" : "Images by finish"}
        </h3>
        <p className={`mt-1 ${ui.bodyMuted}`}>
          {singleFinishMode ? (
            <>
              Photos for <span className="font-medium text-slate-900 dark:text-cream">{activeFinishName}</span>.
              Use the finish tabs above to edit other color variants.
            </>
          ) : (
            <>
              Each door finish gets its own photos. White and Grey variants no longer share the
              same image set.
            </>
          )}
        </p>
      </div>

      {visibleFinishes.map((finish) => (
        <section
          key={finish.id}
          className="rounded-xl border border-slate-200/60 bg-slate-50/50 p-4 dark:border-zinc-700/50 dark:bg-navy/60"
        >
          {!singleFinishMode && (
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-brand">
              {finish.name}
            </p>
          )}
          <ProductImageManager
            productId={productId}
            finishId={finish.id}
            finishName={finish.name}
            disabled={disabled}
            hideFinishHeading={singleFinishMode}
            onPendingChange={
              productId ? undefined : (images) => onPendingChange?.(finish.id, images)
            }
          />
        </section>
      ))}
    </div>
  );
}

export type { PendingImage };
