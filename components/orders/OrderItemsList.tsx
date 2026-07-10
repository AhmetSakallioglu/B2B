import type { OrderItem } from "@/types/orders";
import { formatDimensionsWHD } from "@/lib/format-dimensions";
import { formatPrice } from "@/lib/order-display";
import { ui } from "@/lib/ui-classes";

export function OrderItemsList({ items }: { items: OrderItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className={ui.tableHead}>
          <tr>
            <th className={ui.tableHeadCell}>Product</th>
            <th className={ui.tableHeadCell}>Details</th>
            <th className={ui.tableHeadCell}>Qty</th>
            <th className={`${ui.tableHeadCell} text-right`}>Line total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className={ui.tableRow}>
              <td className={ui.tableCell}>
                <p className="font-semibold text-slate-900 dark:text-cream">{item.productName}</p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-cream/60">
                  {item.productSku} · {item.variantSku}
                </p>
              </td>
              <td className={`${ui.tableCell} text-slate-600 dark:text-cream/75`}>
                <p>{item.color}</p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-cream/60">
                  {formatDimensionsWHD(item.widthIn, item.heightIn, item.depthIn)}
                </p>
              </td>
              <td className={`${ui.tableCell} font-semibold text-slate-900 dark:text-cream`}>
                {item.quantity}
                <span className="mt-0.5 block text-xs font-normal text-slate-500 dark:text-cream/60">
                  @ {formatPrice(item.unitPrice)}
                </span>
              </td>
              <td className={`${ui.tableCell} text-right font-semibold text-slate-900 dark:text-cream`}>
                {formatPrice(item.unitPrice * item.quantity)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
