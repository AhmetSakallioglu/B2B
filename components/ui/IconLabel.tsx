import type { ReactNode } from "react";

type IconLabelProps = {
  icon: ReactNode;
  children: ReactNode;
  className?: string;
};

export function IconLabel({ icon, children, className = "" }: IconLabelProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`.trim()}>
      {icon}
      {children}
    </span>
  );
}
