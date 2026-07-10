import type { Metadata } from "next";
import {
  formatCatalogVariantTitle,
  getCatalogVariantMetadata,
  pageMetadata,
} from "@/lib/site-metadata";
import { RouteMetadataLayout } from "@/lib/route-metadata-layout";

type LayoutProps = {
  params: Promise<{ variantId: string }>;
};

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { variantId } = await params;
  const product = await getCatalogVariantMetadata(variantId);

  if (!product) {
    return pageMetadata("Product Details");
  }

  const title = formatCatalogVariantTitle(product);

  return pageMetadata(title, {
    description: `View ${title} specifications, finish options, and dealer pricing.`,
  });
}

export default RouteMetadataLayout;
