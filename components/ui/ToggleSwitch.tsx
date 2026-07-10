"use client";

type ToggleSwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
  id?: string;
  /** When true, label is used for aria-label only (switch-only layout). */
  labelHidden?: boolean;
};

export function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  label,
  id,
  labelHidden = false,
}: ToggleSwitchProps) {
  const switchButton = (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring disabled:cursor-not-allowed ${
        checked ? "bg-brand" : "bg-slate-300 dark:bg-navy-hover"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );

  if (labelHidden) {
    return switchButton;
  }

  return (
    <label
      htmlFor={id}
      className={`inline-flex items-center gap-2.5 ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      {switchButton}
      <span className="text-xs font-medium text-slate-800 dark:text-cream/90">{label}</span>
    </label>
  );
}
