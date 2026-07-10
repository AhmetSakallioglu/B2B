export type OrderPackingListShippingAddress = {
  addressTitle: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  contactPerson: string | null;
  contactPhone: string | null;
};

export type OrderPackingListItem = {
  productName: string;
  color: string;
  description: string;
  sizes: string;
  quantity: number;
};

export type OrderPackingListData = {
  orderId: number;
  createdAt: string;
  shippingAddress: OrderPackingListShippingAddress | null;
  shippingAddressLines: string[];
  items: OrderPackingListItem[];
};
