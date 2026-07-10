"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CAMPAIGN_SUB_TABS,
  ORDER_SUB_TABS,
  resolveActiveCampaignSubNavTab,
  type AdminCampaignsSubNavTab,
  type AdminOrdersSubNavTab,
} from "@/lib/admin-nav";
import { ui } from "@/lib/ui-classes";

type AdminOrdersNavBarProps = {
  variant: "orders";
  activeOrderTab: AdminOrdersSubNavTab;
};

type AdminCampaignsNavBarProps = {
  variant: "campaigns";
  activeCampaignTab?: AdminCampaignsSubNavTab;
};

type AdminNavBarProps = AdminOrdersNavBarProps | AdminCampaignsNavBarProps;

export function AdminSectionNav(props: AdminNavBarProps) {
  if (props.variant === "orders") {
    return (
      <nav
        aria-label="Orders navigation"
        className={`mb-8 flex w-full flex-wrap items-center gap-1 px-4 py-3 sm:px-5 ${ui.adminCard}`}
      >
        {ORDER_SUB_TABS.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            className={props.activeOrderTab === tab.id ? ui.tabActive : ui.tabIdle}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    );
  }

  const pathname = usePathname();
  const activeTab = props.activeCampaignTab ?? resolveActiveCampaignSubNavTab(pathname);

  return (
    <nav
      aria-label="Campaigns navigation"
      className={`mb-8 flex w-full flex-wrap items-center gap-1 px-4 py-3 sm:px-5 ${ui.adminCard}`}
    >
      {CAMPAIGN_SUB_TABS.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          className={activeTab === tab.id ? ui.tabActive : ui.tabIdle}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

/** @deprecated Use AdminSectionNav */
export const AdminOrdersNavBar = AdminSectionNav;

export type { AdminOrdersSubNavTab, AdminCampaignsSubNavTab } from "@/lib/admin-nav";

/** @deprecated Use AdminSectionNav with variant="orders" */
export function AdminOrdersSubNav({ active }: { active: AdminOrdersSubNavTab }) {
  return <AdminSectionNav variant="orders" activeOrderTab={active} />;
}

/** @deprecated */
export type AdminOrdersActionTab = AdminCampaignsSubNavTab;
