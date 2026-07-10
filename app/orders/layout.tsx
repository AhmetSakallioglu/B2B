import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSessionUser } from "@/lib/auth";
import { pageMetadata } from "@/lib/site-metadata";

export const metadata = pageMetadata("My Orders", {
  description: "Review your cabinet orders, download documents, and track order status.",
});

export default async function OrdersLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login?redirect=/orders");
  }

  if (user.role === "admin") {
    redirect("/admin");
  }

  return children;
}
