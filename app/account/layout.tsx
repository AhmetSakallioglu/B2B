import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSessionUser } from "@/lib/auth";
import { pageMetadata } from "@/lib/site-metadata";

export const metadata = pageMetadata("Dealer Dashboard", {
  description:
    "Manage your dealer company profile, login details, quote branding, and tax exemption settings.",
});

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login?redirect=/account");
  }

  if (user.role === "admin") {
    redirect("/admin");
  }

  return children;
}
