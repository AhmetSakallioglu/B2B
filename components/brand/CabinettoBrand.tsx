import Image from "next/image";
import Link from "next/link";
import { ui } from "@/lib/ui-classes";

type CabinettoBrandProps = {
  subtitle?: string;
  href?: string;
};

export function CabinettoBrand({ subtitle, href = "/" }: CabinettoBrandProps) {
  const wordmark = (
    <span className={ui.brandWordmark}>
      Cabinetto <span className="text-brand">Pro</span>
    </span>
  );

  const logo = (
    <Image
      src="/logo/cabinetto.png"
      alt="Cabinetto"
      width={160}
      height={160}
      priority
      unoptimized
      className="h-11 w-auto shrink-0 object-contain sm:h-12"
    />
  );

  if (subtitle) {
    return (
      <Link href={href} className="inline-flex flex-col gap-1.5">
        <div className="flex items-center gap-3 sm:gap-3.5">
          {logo}
          {wordmark}
        </div>
        <p className={`${ui.brandSubtitle}`}>{subtitle}</p>
      </Link>
    );
  }

  return (
    <Link href={href} className="inline-flex items-center gap-3 sm:gap-3.5">
      {logo}
      {wordmark}
    </Link>
  );
}
