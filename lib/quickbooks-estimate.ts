import { buildQuickBooksInvoicePayload } from "@/lib/quickbooks/invoice-payload";
import {
  getQuickBooksTaxCodeRef,
  getQuickBooksTxnTaxCodeRef,
  QUICKBOOKS_GLOBAL_TAX_CALCULATION,
} from "@/lib/quickbooks/tax-config";
import { roundCurrency } from "@/lib/pricing";
import type { OrderWithCustomer } from "@/types/orders";
import type { QuickBooksEstimateSimulation } from "@/types/quickbooks";

function normalizeEin(value: string) {
  return value.replace(/\D/g, "");
}

function simulateQuickBooksCustomerExists(email: string, ein: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedEin = normalizeEin(ein);

  if (!normalizedEmail || normalizedEin.length !== 9) {
    return false;
  }

  const fingerprint = `${normalizedEmail}:${normalizedEin}`;
  let hash = 0;

  for (let index = 0; index < fingerprint.length; index += 1) {
    hash = (hash + fingerprint.charCodeAt(index) * (index + 1)) % 997;
  }

  return hash % 4 === 0;
}

function buildLineItems(order: OrderWithCustomer) {
  return order.items.map((item) => ({
    sku: item.variantSku || item.productSku,
    description: `${item.productName} (${item.color}) — ${item.widthIn}"W × ${item.heightIn}"H × ${item.depthIn}"D`,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    amount: roundCurrency(item.unitPrice * item.quantity),
  }));
}

export function simulateQuickBooksEstimate(
  order: OrderWithCustomer
): QuickBooksEstimateSimulation | { error: string; status: 400 } {
  const email = order.customer.email.trim();
  const ein = order.customer.federalTaxId.trim();
  const displayName =
    order.customer.companyName.trim() ||
    order.customer.contactName.trim() ||
    email;

  if (!email) {
    return { error: "Customer email is required for QuickBooks estimate export", status: 400 };
  }

  if (!ein) {
    return {
      error: "Customer Federal Tax ID (EIN) is required for QuickBooks estimate export",
      status: 400,
    };
  }

  const normalizedEin = normalizeEin(ein);

  if (normalizedEin.length !== 9) {
    return { error: "Customer EIN must be a valid 9-digit Federal Tax ID", status: 400 };
  }

  const customerExists = simulateQuickBooksCustomerExists(email, ein);
  const customerCreated = !customerExists;
  const customerRef = customerCreated ? "NEW" : "EXISTING";

  if (customerCreated) {
    console.log(`Creating new QuickBooks customer: ${displayName}`);
  } else {
    console.log(`Found existing QuickBooks customer record: ${displayName} (${email})`);
  }

  const lineItems = buildLineItems(order);
  const preTaxSubtotal = roundCurrency(
    lineItems.reduce((sum, line) => sum + line.amount, 0)
  );
  const siteTaxAmount = order.pricing.taxAmount;
  const invoicePayload = buildQuickBooksInvoicePayload(order, customerRef);
  const estimateId = `QB-EST-${order.id}-${Date.now()}`;

  const estimatePayload = {
    estimateId,
    customerRef,
    customerDisplayName: displayName,
    customerEmail: email,
    customerEin: normalizedEin,
    status: "draft" as const,
    lineItems,
    preTaxSubtotal,
    siteTaxAmount,
    totalAmount: order.totalPrice,
    quickBooksInvoice: invoicePayload,
  };

  console.log("QuickBooks Estimate draft prepared:", estimatePayload);

  return {
    simulated: true,
    estimateId,
    status: "draft",
    message: "Estimate created successfully as a draft",
    customerCreated,
    customerDisplayName: displayName,
    customerEmail: email,
    customerEin: normalizedEin,
    lineItems,
    preTaxSubtotal,
    siteTaxAmount,
    totalAmount: order.totalPrice,
    taxConfiguration: {
      globalTaxCalculation: QUICKBOOKS_GLOBAL_TAX_CALCULATION,
      lineTaxCodeRef: getQuickBooksTaxCodeRef(),
      txnTaxCodeRef: getQuickBooksTxnTaxCodeRef(),
      note:
        "Line items are tax-exclusive. QuickBooks calculates Texas sales tax automatically; site tax_amount is not sent as a separate line.",
    },
  };
}
