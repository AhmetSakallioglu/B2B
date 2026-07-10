import type { Metadata } from "next";
import { getOrderPageTitle, pageMetadata } from "@/lib/site-metadata";
import { RouteMetadataLayout } from "@/lib/route-metadata-layout";

type LayoutProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { id } = await params;
  const orderTitle = await getOrderPageTitle(id);

  return pageMetadata(orderTitle ?? "Order Details", {
    description: orderTitle
      ? `Review ${orderTitle}, line items, and delivery details.`
      : undefined,
  });
}

export default RouteMetadataLayout;
