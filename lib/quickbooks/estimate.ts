import { formatModuleCode } from "@/lib/format-module-code";
import { buildQuickBooksInvoicePayload } from "@/lib/quickbooks/invoice-payload";
import { roundCurrency } from "@/lib/pricing";
import type { OrderWithCustomer } from "@/types/orders";
import type { QuickBooksInvoicePayload } from "@/types/quickbooks";

export type QuickBooksLineItem = {
  description: string;
  amount: number;
  quantity: number;
  unitPrice: number;
};

export type QuickBooksEstimateResult = {
  estimateId: string;
  customerId: string;
  attachmentId?: string;
};

export function mapOrderToQuickBooksLineItems(
  order: OrderWithCustomer
): QuickBooksLineItem[] {
  return order.items.map((item) => ({
    description: formatModuleCode(item),
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    amount: roundCurrency(item.unitPrice * item.quantity),
  }));
}

/**
 * Creates a QuickBooks Estimate for the given order.
 * Requires OAuth tokens and active QUICKBOOKS_ENABLED=true.
 */
export async function createQuickBooksEstimate(
  order: OrderWithCustomer,
  pdfBuffer: Buffer
): Promise<QuickBooksEstimateResult> {
  void pdfBuffer;
  const customerId = await findOrCreateQuickBooksCustomer(order.customer.email);
  const invoicePayload = buildQuickBooksInvoicePayload(order, customerId);
  void invoicePayload;
  throw new Error(
    "QuickBooks estimate creation is not enabled yet. Set QUICKBOOKS_ENABLED=true after OAuth setup."
  );
}

export function buildQuickBooksEstimatePayload(
  order: OrderWithCustomer,
  customerRef: string
): QuickBooksInvoicePayload {
  return buildQuickBooksInvoicePayload(order, customerRef);
}

/**
 * Finds an existing QuickBooks customer by email or creates a new one.
 */
export async function findOrCreateQuickBooksCustomer(
  _email: string
): Promise<string> {
  void _email;
  throw new Error(
    "QuickBooks customer sync is not enabled yet. Set QUICKBOOKS_ENABLED=true after OAuth setup."
  );
}

/**
 * Attaches a generated PDF to a QuickBooks Estimate.
 */
export async function attachPdfToQuickBooksEstimate(
  _estimateId: string,
  _pdfBuffer: Buffer,
  _fileName: string
): Promise<string> {
  void _estimateId;
  void _pdfBuffer;
  void _fileName;
  throw new Error(
    "QuickBooks attachment upload is not enabled yet. Set QUICKBOOKS_ENABLED=true after OAuth setup."
  );
}
