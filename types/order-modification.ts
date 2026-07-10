export type OrderCartSnapshotItem = {
  itemId: number;
  variantId: number;
  variantSku: string;
  productSku: string;
  productName: string;
  color: string;
  quantity: number;
  unitPrice: number;
};

export type OrderModificationLineInput = {
  itemId?: number;
  variantSku?: string;
  quantity: number;
};

export type PendingOrderModification = {
  items: Array<{
    variantId: number;
    quantity: number;
    unitPrice: number;
  }>;
  pricing: {
    subtotal: number;
    promoDiscount: number;
    msrpSubtotal: number;
    tierName: string;
    tierDiscountPercent: number;
    tierDiscountAmount: number;
    taxRate: number;
    taxAmount: number;
    shippingAmount: number;
    totalAmount: number;
  };
  oldTotalAmount: number;
  balanceDue: number;
  oldCart: OrderCartSnapshotItem[];
  newCart: OrderCartSnapshotItem[];
};

export type OrderModificationResult = {
  outcome: "applied" | "awaiting_payment" | "refunded";
  orderId: number;
  oldTotalAmount: number;
  newTotalAmount: number;
  balanceDelta: number;
  refundAmount?: number;
  checkoutUrl?: string;
};
