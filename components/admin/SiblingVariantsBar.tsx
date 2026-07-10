import Link from "next/link";
import { ui } from "@/lib/ui-classes";
import type { AdminProductSiblingVariant } from "@/types/admin";

type SiblingVariantsBarProps = {
  productSku: string;
  widthIn: number;
  heightIn: number;
  depthIn: number;
  currentVariantId: number;
  siblings: AdminProductSiblingVariant[];
};

export function SiblingVariantsBar({
  productSku,
  widthIn,
  heightIn,
  depthIn,
  currentVariantId,
  siblings,
}: SiblingVariantsBarProps) {
  if (siblings.length <= 1) {
    return null;
  }

  return (
    <section className={`mb-6 p-4 ${ui.adminCard}`}>
      <p className={ui.fieldLabel}>Same cabinet · other finishes</p>
      <p className="mt-1 text-sm font-medium text-slate-900 dark:text-cream">
        {productSku} · {widthIn}&quot; × {heightIn}&quot; × {depthIn}&quot;
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {siblings.map((sibling) => {
          const isCurrent = sibling.variantId === currentVariantId;

          return (
            <Link
              key={sibling.variantId}
              href={`/admin/products/${sibling.variantId}/edit`}
              className={
                isCurrent ? ui.catalogSubPillActive : ui.catalogSubPillIdle
              }
              aria-current={isCurrent ? "page" : undefined}
            >
              {sibling.finishName}
              {isCurrent ? (
                <span className="text-[10px] font-semibold uppercase tracking-wide opacity-85">
                  · Current
                </span>
              ) : (
                <span className="text-xs opacity-70">Edit</span>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
