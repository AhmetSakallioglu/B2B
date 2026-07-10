function toPromoExpiryDate(expiresAt: string | Date) {
  return expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
}

export function formatPromoExpiryForEmail(expiresAt: string | Date) {
  const date = toPromoExpiryDate(expiresAt);

  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatPromoExpiryShort(expiresAt: string | Date) {
  return toPromoExpiryDate(expiresAt).toLocaleDateString("en-US");
}
