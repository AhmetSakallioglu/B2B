export function getAppBaseUrl() {
  const configured =
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_URL?.trim();

  if (!configured) {
    return "http://localhost:3000";
  }

  if (configured.startsWith("http://") || configured.startsWith("https://")) {
    return configured.replace(/\/$/, "");
  }

  return `https://${configured.replace(/\/$/, "")}`;
}

export function absoluteAssetUrl(path: string | null | undefined, baseUrl = getAppBaseUrl()) {
  if (!path) {
    return null;
  }

  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export function cartPageUrl(baseUrl = getAppBaseUrl()) {
  return `${baseUrl}/cart`;
}

export function accountQuotesUrl(baseUrl = getAppBaseUrl()) {
  return `${baseUrl}/account/quotes`;
}
