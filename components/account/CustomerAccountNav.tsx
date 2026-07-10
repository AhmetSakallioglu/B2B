import Link from "next/link";
import type { ReactNode } from "react";
import {
  ClipboardListIcon,
  GridIcon,
  LayersIcon,
  MailIcon,
  PackageIcon,
  ShoppingCartIcon,
  UserIcon,
} from "@/components/ui/Icon";
import { IconLabel } from "@/components/ui/IconLabel";
import {
  CUSTOMER_ACCOUNT_NAV_GROUPS,
  getCustomerAccountNavItemsByGroup,
  type CustomerAccountNavId,
} from "@/lib/customer-account-nav";
import { ui } from "@/lib/ui-classes";

type CustomerAccountNavProps = {
  active: CustomerAccountNavId;
};

const NAV_LINK_BASE =
  "inline-flex shrink-0 items-center whitespace-nowrap rounded-xl px-3 py-2 text-sm transition duration-200 sm:px-3.5";

const NAV_ICONS: Record<CustomerAccountNavId, ReactNode> = {
  account: <UserIcon size={15} />,
  addresses: <LayersIcon size={15} />,
  orders: <PackageIcon size={15} />,
  quotes: <ClipboardListIcon size={15} />,
  "client-quotes": <MailIcon size={15} />,
  "room-templates": <GridIcon size={15} />,
  cart: <ShoppingCartIcon size={15} />,
};

function navLinkClass(isActive: boolean, isCart: boolean) {
  if (isActive) {
    return `${NAV_LINK_BASE} bg-brand font-semibold text-white shadow-sm`;
  }

  if (isCart) {
    return `${NAV_LINK_BASE} border border-brand/30 bg-brand-light/20 font-semibold text-brand hover:border-brand/45 hover:bg-brand-light/35 dark:border-brand/35 dark:bg-brand-light/10 dark:hover:bg-brand-light/15`;
  }

  return `${NAV_LINK_BASE} border border-slate-200 bg-white font-medium text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 dark:border-zinc-700/50 dark:bg-navy dark:text-cream/90 dark:hover:bg-navy-hover`;
}

function NavDivider() {
  return (
    <div
      aria-hidden
      className="mx-1 hidden h-8 w-px shrink-0 self-center bg-slate-200/90 sm:block dark:bg-zinc-700/60"
    />
  );
}

function NavGroup({
  label,
  active,
  groupId,
}: {
  label: string;
  active: CustomerAccountNavId;
  groupId: (typeof CUSTOMER_ACCOUNT_NAV_GROUPS)[number]["id"];
}) {
  const items = getCustomerAccountNavItemsByGroup(groupId);

  return (
    <div className="flex shrink-0 flex-col gap-1.5">
      <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-cream/45">
        {label}
      </p>
      <div className="flex items-center gap-1.5">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            title={item.fullLabel}
            aria-current={item.id === active ? "page" : undefined}
            className={navLinkClass(item.id === active, item.id === "cart")}
          >
            <IconLabel icon={NAV_ICONS[item.id]}>{item.label}</IconLabel>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function CustomerAccountNav({ active }: CustomerAccountNavProps) {
  return (
    <nav aria-label="Account navigation" className={`overflow-hidden ${ui.catalogCard}`}>
      <div className="overflow-x-auto p-2.5 sm:p-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max items-end gap-2 sm:gap-3">
          {CUSTOMER_ACCOUNT_NAV_GROUPS.map((group, index) => (
            <div key={group.id} className="flex shrink-0 items-end gap-2 sm:gap-3">
              {index > 0 && <NavDivider />}
              <NavGroup label={group.label} active={active} groupId={group.id} />
            </div>
          ))}
        </div>
      </div>
    </nav>
  );
}

export type { CustomerAccountNavId };
