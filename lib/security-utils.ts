export function sanitizeRedirectUrl(url: string | null | undefined): string {
  if (!url) {
    return "/";
  }

  const isRelative = /^\/(?!\/|\\)/.test(url);

  return isRelative ? url : "/";
}
