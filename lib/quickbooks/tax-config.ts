/**
 * QuickBooks tax configuration.
 * Line items are sent tax-exclusive; QuickBooks calculates Texas sales tax automatically.
 * Do NOT send site-calculated tax_amount as a separate line — that causes double taxation.
 */
export function getQuickBooksTaxCodeRef() {
  return process.env.QUICKBOOKS_TEXAS_TAX_CODE_REF?.trim() || "TAX";
}

export function getQuickBooksTxnTaxCodeRef() {
  return process.env.QUICKBOOKS_TXN_TAX_CODE_REF?.trim() || getQuickBooksTaxCodeRef();
}

/** QBO automated sales tax — tax is computed from customer ship/bill address in QuickBooks. */
export const QUICKBOOKS_GLOBAL_TAX_CALCULATION = "TaxExcluded" as const;
