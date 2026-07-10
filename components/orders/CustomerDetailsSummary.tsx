import { buildCustomerPdfLines } from "@/lib/customer-display";
import type { OrderCustomer } from "@/types/orders";

type CustomerDetailsSummaryProps = {
  customer: OrderCustomer;
};

export function CustomerDetailsSummary({ customer }: CustomerDetailsSummaryProps) {
  const lines = buildCustomerPdfLines(customer);

  return (
    <div className="space-y-1 text-sm text-navy/90 dark:text-cream/90">
      {lines.map((line) => (
        <p
          key={line}
          className={
            line === customer.companyName
              ? "font-semibold text-navy dark:text-cream"
              : undefined
          }
        >
          {line}
        </p>
      ))}
    </div>
  );
}
