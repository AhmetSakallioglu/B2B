import { validatePassword } from "@/lib/password-policy";

export type PasswordStrength = "empty" | "weak" | "medium" | "strong";

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return "empty";
  }

  if (validatePassword(password)) {
    return "weak";
  }

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);
  const length = password.length;

  const score =
    (length >= 12 ? 2 : length >= 10 ? 1 : 0) +
    (hasLower && hasUpper ? 1 : 0) +
    (hasNumber ? 1 : 0) +
    (hasSpecial ? 1 : 0);

  if (score >= 4) {
    return "strong";
  }

  return "medium";
}

export const PASSWORD_STRENGTH_META: Record<
  Exclude<PasswordStrength, "empty">,
  { label: string; barClass: string; textClass: string; width: string }
> = {
  weak: {
    label: "Weak",
    barClass: "bg-red-500",
    textClass: "text-red-600 dark:text-red-400",
    width: "w-1/3",
  },
  medium: {
    label: "Medium",
    barClass: "bg-amber-500",
    textClass: "text-amber-600 dark:text-amber-400",
    width: "w-2/3",
  },
  strong: {
    label: "Strong",
    barClass: "bg-emerald-500",
    textClass: "text-emerald-600 dark:text-emerald-400",
    width: "w-full",
  },
};
