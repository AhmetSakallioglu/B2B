export type ShippingZoneRow = {
  id: string;
  zone_name: string;
  base_price: string;
  zip_codes: string[];
  free_shipping_threshold: string | null;
  created_at: Date;
  updated_at: Date;
};

export type ShippingZone = {
  id: string;
  zoneName: string;
  basePrice: number;
  zipCodes: string[];
  freeShippingThreshold: number | null;
  createdAt: string;
  updatedAt: string;
};

export type ShippingQuote = {
  zoneId: string | null;
  zoneName: string | null;
  basePrice: number;
  shippingAmount: number;
  isFreeShipping: boolean;
  isOutOfZone: boolean;
  notice: string | null;
  postalCode: string;
};

export type ShippingSettings = {
  defaultOutOfZoneRate: number;
};
