export type CatalogCategory = {
  id: number;
  name: string;
  slug: string;
  subCategories: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
};

export type CreateProductRequest = {
  categorySlug: string;
  subCategorySlug: string;
  productSku: string;
  productName: string;
  description: string;
  imageUrl?: string | null;
  widthIn: number;
  heightIn: number;
  depthIn: number;
  finishIds: number[];
  color: string;
  stockStatus: "in_stock" | "out_of_stock";
  price: number;
  variantSku?: string;
};

export type UpdateProductRequest = CreateProductRequest & {
  imageUrl?: string | null;
};

export type AdminProductSiblingVariant = {
  variantId: number;
  finishId: number;
  finishName: string;
  finishSlug: string;
  variantSku: string;
  stockStatus: "in_stock" | "out_of_stock";
  price: number;
};

export type AdminProductDetail = {
  variantId: number;
  productId: number;
  categorySlug: string;
  subCategorySlug: string;
  productSku: string;
  productName: string;
  description: string;
  imageUrl: string | null;
  productImages: string[];
  variantImages: string[];
  finishImages: string[];
  widthIn: number;
  heightIn: number;
  depthIn: number;
  finishId: number;
  finishName: string;
  finishSlug: string;
  finishIds: number[];
  siblings: AdminProductSiblingVariant[];
  color: string;
  stockStatus: "in_stock" | "out_of_stock";
  price: number;
  variantSku: string;
  category: string;
  subCategory: string;
};

export type AdminProductRow = {
  product_id: number;
  variant_id: number;
  variant_sku: string;
  product_sku: string;
  product_name: string;
  is_listed: boolean;
  category: string;
  sub_category: string;
  width_in: string;
  height_in: string;
  depth_in: string;
  color: string;
  finish_id: number;
  finish_name: string;
  finish_slug: string;
  stock_status: string;
  price: string;
  image_url: string | null;
};
