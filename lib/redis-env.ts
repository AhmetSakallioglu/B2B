export function getRedisRestConfig() {
  const url =
    process.env.REDIS_URL?.trim() ??
    process.env.UPSTASH_REDIS_REST_URL?.trim() ??
    "";

  const token =
    process.env.REDIS_TOKEN?.trim() ??
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ??
    "";

  if (!url || !token) {
    return null;
  }

  return { url, token };
}

export function isUpstashRestUrl(url: string) {
  return url.startsWith("https://") || url.startsWith("http://");
}
