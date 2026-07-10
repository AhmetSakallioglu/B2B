export const DELETED_SKU_SUFFIX_PATTERN = /_deleted_\d+$/;

export function stripDeletedSkuSuffix(sku: string) {
  return sku.replace(DELETED_SKU_SUFFIX_PATTERN, "");
}

export function isDeletedSku(sku: string) {
  return DELETED_SKU_SUFFIX_PATTERN.test(sku);
}

export function buildDeletedSku(originalSku: string, deletedAt = new Date()) {
  const timestamp = Math.floor(deletedAt.getTime() / 1000);
  const baseSku = stripDeletedSkuSuffix(originalSku.trim());
  return `${baseSku}_deleted_${timestamp}`;
}
