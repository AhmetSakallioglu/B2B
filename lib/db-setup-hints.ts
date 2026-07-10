type PostgresErrorLike = {
  code?: string;
  message?: string;
};

export function databaseSetupHint(error: unknown) {
  if (!error || typeof error !== "object") {
    return "";
  }

  const pgError = error as PostgresErrorLike;

  if (pgError.code !== "42P01" && pgError.code !== "42703") {
    return "";
  }

  const message = pgError.message ?? "";

  if (message.includes("cart_applied_promos")) {
    return " Run: npm run db:promo-codes && npm run db:cart-applied-promo — then restart the app.";
  }

  if (message.includes("promo_codes")) {
    return " Run: npm run db:promo-codes — then restart the app.";
  }

  if (message.includes("client_quotes") || message.includes("company_logo_url")) {
    return " Run: npm run db:client-quotes && npm run db:client-quotes-status — then restart the app.";
  }

  if (message.includes("room_templates")) {
    return " Run: npm run db:room-templates — then restart the app.";
  }

  return " Database setup may be incomplete — check pending npm run db:* scripts in package.json, then restart.";
}
