function normalizeDimension(value: number | string) {
  const numeric =
    typeof value === "number"
      ? value
      : Number.parseFloat(value.replace(/"/g, "").trim());

  if (Number.isNaN(numeric)) {
    return String(value).replace(/"/g, "").trim();
  }

  return parseFloat(numeric.toFixed(2)).toString();
}

export function formatDimensionsWHD(
  width: number | string,
  height: number | string,
  depth: number | string
) {
  return `(${normalizeDimension(width)} W × ${normalizeDimension(height)} H × ${normalizeDimension(depth)} D)`;
}

export function buildCartItemLabel(
  productSku: string,
  color: string,
  width: number | string,
  height: number | string,
  depth: number | string
) {
  return `${productSku} · ${color} ${formatDimensionsWHD(width, height, depth)}`;
}

export function stripCartItemDimensions(name: string) {
  return name.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

export function getCartItemDimensionsLabel(item: {
  name: string;
  width?: string;
  height?: string;
  depth?: string;
}) {
  if (item.width && item.height && item.depth) {
    return formatDimensionsWHD(item.width, item.height, item.depth);
  }

  const match = item.name.match(/\([^)]+\)\s*$/);
  return match?.[0] ?? null;
}
