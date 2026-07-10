export function normalizeShippingZip(input: string): string | null {
  const trimmed = input.trim();

  if (!trimmed) {
    return null;
  }

  const match = /^(\d{5})(?:-\d{4})?$/.exec(trimmed);
  return match ? match[1] : null;
}

export function parseZipCodesInput(input: string): string[] {
  const unique = new Set<string>();

  for (const token of input.split(/[,;\n]+/)) {
    const normalized = normalizeShippingZip(token.trim());

    if (normalized) {
      unique.add(normalized);
    }
  }

  return [...unique];
}
