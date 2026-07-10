export type RoomTemplateStoredItem = {
  variant_id: number;
  cabinet_code: string;
  quantity: number;
};

export type RoomTemplateSummary = {
  id: string;
  templateName: string;
  lineCount: number;
  totalQuantity: number;
  createdAt: string;
  updatedAt: string;
};

export type RoomTemplateDetail = RoomTemplateSummary & {
  items: RoomTemplateStoredItem[];
  userId: number;
};

export type RoomTemplateSaveRequest = {
  templateName: string;
  items: Array<{ variantId: string; quantity: number }>;
};

export type RoomTemplateAddToCartRequest = {
  multiplier: number;
};
