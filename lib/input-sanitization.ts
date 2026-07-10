const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;
const HTML_TAG_PATTERN = /<[^>]*>/g;
const SQL_INJECTION_FRAGMENTS = [
  /--/g,
  /\/\*/g,
  /\*\//g,
  /;/g,
  /'\s*or\s+'1'\s*=\s*'1/gi,
  /union\s+select/gi,
];

export function stripSqlInjectionFragments(value: string) {
  let cleaned = value;

  for (const pattern of SQL_INJECTION_FRAGMENTS) {
    cleaned = cleaned.replace(pattern, "");
  }

  return cleaned;
}

export function sanitizeHtmlAndXss(value: string) {
  return value.replace(HTML_TAG_PATTERN, "");
}

export function sanitizePlainText(
  value: unknown,
  maxLength: number,
  required = false
): string | null {
  if (typeof value !== "string") {
    return required ? null : "";
  }

  const cleaned = stripSqlInjectionFragments(
    sanitizeHtmlAndXss(value.replace(CONTROL_CHARS, "").trim())
  ).slice(0, maxLength);

  if (required && cleaned.length === 0) {
    return null;
  }

  return cleaned;
}

export function sanitizeOptionalPlainText(value: unknown, maxLength: number): string | null {
  const cleaned = sanitizePlainText(value, maxLength, false);
  return cleaned ? cleaned : null;
}

export function sanitizeInboundString(value: unknown, maxLength: number): string {
  if (typeof value !== "string") {
    return "";
  }

  return stripSqlInjectionFragments(sanitizeHtmlAndXss(value.replace(CONTROL_CHARS, "").trim())).slice(
    0,
    maxLength
  );
}
