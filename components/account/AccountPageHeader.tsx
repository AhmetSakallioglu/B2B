import Link from "next/link";
import type { ReactNode } from "react";
import {
  CustomerAccountNav,
  type CustomerAccountNavId,
} from "@/components/account/CustomerAccountNav";
import { StoreIcon } from "@/components/ui/Icon";
import { ui } from "@/lib/ui-classes";

type AccountPageHeaderProps = {
  active: CustomerAccountNavId;
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
};

export function AccountPageHeader({
  active,
  icon,
  title,
  description,
  action,
}: AccountPageHeaderProps) {
  return (
    <header className={ui.adminHeaderBar}>
      <div className={`${ui.pageContainerNarrow} py-4`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className={ui.eyebrow}>Account</p>
            <h1 className={`mt-2 flex items-center gap-2 ${ui.heading1}`}>
              <span className="text-brand">{icon}</span>
              {title}
            </h1>
            <p className={`mt-1.5 ${ui.bodyMuted}`}>{description}</p>
          </div>
          {action}
        </div>

        <div className="mt-5">
          <CustomerAccountNav active={active} />
        </div>
      </div>
    </header>
  );
}

export function AccountBackToCatalogLink() {
  return (
    <Link href="/catalog" className={`${ui.btnSecondary} inline-flex shrink-0 items-center gap-2`}>
      <StoreIcon size={15} />
      Back to catalog
    </Link>
  );
}
