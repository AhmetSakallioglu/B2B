export type StockStatus = "In Stock" | "Out of Stock";

export type CatalogProduct = {
  id: string;
  productSku: string;
  name: string;
  description: string;
  category: string;
  categorySlug: string;
  subCategory: string;
  subCategorySlug: string;
  width: string;
  height: string;
  depth: string;
  color: string;
  finishSlug: string;
  stockStatus: StockStatus;
  price?: number;
  listPrice?: number;
  image: string;
  images: string[];
  gallerySources?: GallerySources;
};

export type ProductImage = {
  id: number;
  productId: number;
  finishId: number;
  url: string;
  sortOrder: number;
  isCover: boolean;
};

export type FinishImagePayload = {
  finishId: number;
  imageUrls: string[];
  coverImageUrl: string | null;
};

export type CatalogProductDetail = CatalogProduct & {
  variantSku: string;
  gallerySources: GallerySources;
};

export type GallerySources = {
  productImages: string[];
  finishImages: string[];
  variantImages: string[];
};

export type DoorFinish = {
  id: number;
  name: string;
  slug: string;
  variantCount: number;
  sampleImage: string;
  finishImages: string[];
};

export type CatalogPricing = {
  discountPercent: number;
  tierName: string | null;
} | null;

export type OrderCartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  width?: string;
  height?: string;
  depth?: string;
};

export type CatalogProductRow = {
  variant_id: number;
  variant_sku: string;
  product_sku: string;
  product_name: string;
  description: string | null;
  image_url: string | null;
  category: string;
  category_slug: string;
  sub_category: string;
  sub_category_slug: string;
  width_in: string;
  height_in: string;
  depth_in: string;
  color: string;
  finish_id: number;
  finish_slug: string;
  stock_status: "in_stock" | "out_of_stock";
  price: string;
};
