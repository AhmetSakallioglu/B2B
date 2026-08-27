"use client";

import Link from "next/link";
import { ArchiveIcon, ClipboardListIcon } from "@/components/ui/Icon";
import { ui } from "@/lib/ui-classes";

type QuotesFolderNavProps = {
  archived: boolean;
};

export function QuotesFolderNav({ archived }: QuotesFolderNavProps) {
  return (
    <div className={`mb-2 ${ui.tabBar}`}>
      <Link
        href="/account/quotes"
        className={`inline-flex items-center gap-2 ${!archived ? ui.tabActive : ui.tabIdle}`}
      >
        <ClipboardListIcon size={14} />
        Active quotes
      </Link>
      <Link
        href="/account/quotes/archive"
        className={`inline-flex items-center gap-2 ${archived ? ui.tabActive : ui.tabIdle}`}
      >
        <ArchiveIcon size={14} />
        Archive
      </Link>
    </div>
  );
}
