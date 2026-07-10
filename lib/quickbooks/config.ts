export type QuickBooksConfig = {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  realmId: string;
  redirectUri: string;
  refreshToken: string;
  environment: "sandbox" | "production";
};

export function getQuickBooksConfig(): QuickBooksConfig {
  const environment =
    process.env.QUICKBOOKS_ENVIRONMENT === "production"
      ? "production"
      : "sandbox";

  return {
    enabled: process.env.QUICKBOOKS_ENABLED === "true",
    clientId: process.env.QUICKBOOKS_CLIENT_ID ?? "",
    clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET ?? "",
    realmId: process.env.QUICKBOOKS_REALM_ID ?? "",
    redirectUri: process.env.QUICKBOOKS_REDIRECT_URI ?? "",
    refreshToken: process.env.QUICKBOOKS_REFRESH_TOKEN ?? "",
    environment,
  };
}

export function isQuickBooksConfigured(config: QuickBooksConfig = getQuickBooksConfig()) {
  return (
    config.enabled &&
    config.clientId.length > 0 &&
    config.clientSecret.length > 0 &&
    config.realmId.length > 0 &&
    config.redirectUri.length > 0
  );
}

export function getQuickBooksApiBaseUrl(
  config: QuickBooksConfig = getQuickBooksConfig()
) {
  return config.environment === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";
}
