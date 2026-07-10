export type AdminSubCategory = {
  id: number;
  name: string;
  slug: string;
  productCount: number;
};

export type AdminCategory = {
  id: number;
  name: string;
  slug: string;
  productCount: number;
  subCategories: AdminSubCategory[];
};
