import { roundCurrency } from "@/lib/pricing";

/** Texas state + local combined rate applied at checkout (8.25%). */
export const TEXAS_SALES_TAX_RATE = 0.0825;

export type DealerTaxStatus = "taxable" | "exempt";

export type SalesTaxBreakdown = {
  taxableSubtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
};

export function formatTexasTaxRatePercent(taxRate: number) {
  if (taxRate <= 0) {
    return "0";
  }

  const percent = taxRate * 100;
  return Number.isInteger(percent) ? String(percent) : percent.toFixed(2);
}

/**
 * Computes Texas sales tax on the provided taxable base (typically discounted
 * merchandise subtotal plus shipping). Uses cent-safe rounding via roundCurrency.
 */
export function calculateTexasSalesTax(
  taxableSubtotal: number,
  taxStatus: DealerTaxStatus = "taxable"
): SalesTaxBreakdown {
  const netSubtotal = roundCurrency(Math.max(0, taxableSubtotal));

  if (taxStatus === "exempt" || netSubtotal <= 0) {
    return {
      taxableSubtotal: netSubtotal,
      taxRate: 0,
      taxAmount: 0,
      totalAmount: netSubtotal,
    };
  }

  const taxRate = TEXAS_SALES_TAX_RATE;
  const taxAmount = roundCurrency(netSubtotal * taxRate);
  const totalAmount = roundCurrency(netSubtotal + taxAmount);

  return {
    taxableSubtotal: netSubtotal,
    taxRate,
    taxAmount,
    totalAmount,
  };
}
