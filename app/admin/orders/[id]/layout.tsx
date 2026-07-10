import type { Metadata } from "next";
import { adminSectionMetadata, getOrderPageTitle } from "@/lib/site-metadata";
import { RouteMetadataLayout } from "@/lib/route-metadata-layout";

type LayoutProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { id } = await params;
  const orderTitle = await getOrderPageTitle(id);

  return adminSectionMetadata(orderTitle ?? "Order Details");
}

export default RouteMetadataLayout;
