type PostgresErrorLike = {
  code?: string;
  message?: string;
};

export function databaseSetupHint(error: unknown) {
  if (!error || typeof error !== "object") {
    return "";
  }

  const pgError = error as PostgresErrorLike;
  const message = pgError.message ?? "";

  if (pgError.code === "23514" && message.includes("quotes_status_check")) {
    return " Run: npm run db:quotes-archive — then restart the app.";
  }

  if (pgError.code !== "42P01" && pgError.code !== "42703") {
    return "";
  }

  if (message.includes("cart_applied_promos")) {
    return " Run: npm run db:promo-codes && npm run db:cart-applied-promo — then restart the app.";
  }

  if (message.includes("can_create_users") || message.includes("can_delete_users")) {
    return " Run: npm run db:user-management-permissions — then restart the app.";
  }

  if (message.includes("account_status") && message.includes("deleted")) {
    return " Run: npm run db:user-deleted-status — then restart the app.";
  }

  if (message.includes("client_quotes") || message.includes("company_logo_url")) {
    return " Run: npm run db:client-quotes && npm run db:client-quotes-status — then restart the app.";
  }

  if (message.includes("room_templates")) {
    return " Run: npm run db:room-templates — then restart the app.";
  }

  return " Database setup may be incomplete — check pending npm run db:* scripts in package.json, then restart.";
}
