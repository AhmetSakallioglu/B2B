"use client";

import {
  getPasswordStrength,
  PASSWORD_STRENGTH_META,
  type PasswordStrength,
} from "@/lib/password-strength";

type PasswordStrengthMeterProps = {
  password: string;
};

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const strength = getPasswordStrength(password);

  if (strength === "empty") {
    return (
      <div className="space-y-2">
        <div className="h-2 overflow-hidden rounded-full bg-cream-dark dark:bg-navy-hover">
          <div className="h-full w-0 bg-border" />
        </div>
        <p className="text-xs text-muted dark:text-cream/60">
          Use at least 8 characters with letters and numbers.
        </p>
      </div>
    );
  }

  const meta = PASSWORD_STRENGTH_META[strength];

  return (
    <div className="space-y-2">
      <div className="h-2 overflow-hidden rounded-full bg-cream-dark dark:bg-navy-hover">
        <div
          className={`h-full rounded-full transition-all duration-300 ${meta.barClass} ${meta.width}`}
        />
      </div>
      <p className={`text-xs font-medium ${meta.textClass}`}>
        Password strength: {meta.label}
      </p>
    </div>
  );
}

export type { PasswordStrength };
