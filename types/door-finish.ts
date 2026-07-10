import type { DoorFinish } from "@/types/catalog";

export type DoorFinishRow = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  sample_image_url: string | null;
  finish_images: string[] | null;
  sort_order: number;
  is_active: boolean;
  variant_count?: string;
  cart_items_count?: string;
};

export type AdminDoorFinish = DoorFinish & {
  description: string;
  sortOrder: number;
  isActive: boolean;
  cartItemsCount: number;
};

export type UpsertDoorFinishBody = {
  name: string;
  slug: string;
  description: string;
  sampleImageUrl: string | null;
  finishImages?: string[];
  sortOrder: number;
  isActive: boolean;
};

export type UpdateDoorFinishBody = Omit<UpsertDoorFinishBody, "sampleImageUrl" | "finishImages"> & {
  sampleImageUrl?: string | null;
  finishImages?: string[];
};
