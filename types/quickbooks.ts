export type QuickBooksEstimateLineItem = {
  sku: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
};

export type QuickBooksEstimateSimulation = {
  simulated: true;
  estimateId: string;
  status: "draft";
  message: string;
  customerCreated: boolean;
  customerDisplayName: string;
  customerEmail: string;
  customerEin: string;
  lineItems: QuickBooksEstimateLineItem[];
  /** Pre-tax merchandise subtotal sent to QuickBooks (tax computed by QB). */
  preTaxSubtotal: number;
  /** Site-collected tax for reconciliation only — not sent as a QB line item. */
  siteTaxAmount: number;
  /** Tax-inclusive total charged on the website. */
  totalAmount: number;
  taxConfiguration: {
    globalTaxCalculation: "TaxExcluded";
    lineTaxCodeRef: string;
    txnTaxCodeRef: string;
    note: string;
  };
};

export type QuickBooksRef = {
  value: string;
};

export type QuickBooksAddress = {
  Line1?: string;
  Line2?: string;
  City?: string;
  CountrySubDivisionCode?: string;
  PostalCode?: string;
  Country?: string;
};

export type QuickBooksInvoiceLine = {
  DetailType: "SalesItemLineDetail";
  Description: string;
  Amount: number;
  SalesItemLineDetail: {
    Qty: number;
    UnitPrice: number;
    TaxCodeRef: QuickBooksRef;
  };
};

export type QuickBooksInvoicePayload = {
  CustomerRef: QuickBooksRef;
  BillAddr: QuickBooksAddress;
  ShipAddr: QuickBooksAddress;
  GlobalTaxCalculation: "TaxExcluded";
  TxnTaxDetail: {
    TxnTaxCodeRef: QuickBooksRef;
  };
  Line: QuickBooksInvoiceLine[];
  PrivateNote: string;
  DocNumber: string;
};

export type QuickBooksEstimateApiResponse = QuickBooksEstimateSimulation;

export type QuickBooksEstimateApiError = {
  error: string;
};
