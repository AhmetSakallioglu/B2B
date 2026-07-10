import { mapOrderToQuickBooksLineItems } from "@/lib/quickbooks/estimate";
import {
  getQuickBooksTaxCodeRef,
  getQuickBooksTxnTaxCodeRef,
  QUICKBOOKS_GLOBAL_TAX_CALCULATION,
} from "@/lib/quickbooks/tax-config";
import { roundCurrency } from "@/lib/pricing";
import type { OrderWithCustomer } from "@/types/orders";
import type { QuickBooksInvoicePayload } from "@/types/quickbooks";

function buildCustomerAddress(order: OrderWithCustomer) {
  const customer = order.customer;

  return {
    Line1: customer.addressLine1 || undefined,
    Line2: customer.addressLine2 || undefined,
    City: customer.city || undefined,
    CountrySubDivisionCode: customer.state || undefined,
    PostalCode: customer.postalCode || undefined,
    Country: customer.country || "US",
  };
}

/**
 * Builds a QuickBooks Invoice / Sales Receipt payload.
 * Product lines use pre-tax unit prices only; site tax_amount is intentionally omitted
 * so QuickBooks automated tax can apply Texas sales tax without duplication.
 */
export function buildQuickBooksInvoicePayload(
  order: OrderWithCustomer,
  customerRef: string
): QuickBooksInvoicePayload {
  const lineTaxCode = getQuickBooksTaxCodeRef();
  const txnTaxCode = getQuickBooksTxnTaxCodeRef();
  const preTaxLines = mapOrderToQuickBooksLineItems(order);

  const lineItems = preTaxLines.map((item) => ({
    DetailType: "SalesItemLineDetail" as const,
    Description: item.description,
    Amount: roundCurrency(item.amount),
    SalesItemLineDetail: {
      Qty: item.quantity,
      UnitPrice: roundCurrency(item.unitPrice),
      TaxCodeRef: { value: lineTaxCode },
    },
  }));

  const preTaxSubtotal = roundCurrency(
    preTaxLines.reduce((sum, line) => sum + line.amount, 0)
  );

  return {
    CustomerRef: { value: customerRef },
    BillAddr: buildCustomerAddress(order),
    ShipAddr: buildCustomerAddress(order),
    GlobalTaxCalculation: QUICKBOOKS_GLOBAL_TAX_CALCULATION,
    TxnTaxDetail: {
      TxnTaxCodeRef: { value: txnTaxCode },
    },
    Line: lineItems,
    PrivateNote: `Cabinetto order #${order.id}. Pre-tax merchandise ${preTaxSubtotal.toFixed(2)} USD; Texas sales tax calculated by QuickBooks.`,
    DocNumber: `ORD-${order.id}`,
  };
}
