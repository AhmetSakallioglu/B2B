const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function isMutationMethod(method: string) {
  return MUTATION_METHODS.has(method.toUpperCase());
}

export function getConfiguredAppHosts(): Set<string> {
  const hosts = new Set<string>();

  for (const envKey of ["APP_URL", "NEXT_PUBLIC_APP_URL", "VERCEL_URL"] as const) {
    const value = process.env[envKey]?.trim();

    if (!value) {
      continue;
    }

    try {
      const normalized = value.includes("://") ? value : `https://${value}`;
      hosts.add(new URL(normalized).host);
    } catch {
      // Ignore malformed environment URLs.
    }
  }

  return hosts;
}

export function allowsMutationWithoutOrigin(): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  return process.env.ALLOW_INSECURE_MUTATIONS === "1";
}

export function validateMutationOriginFromHeaders(
  method: string,
  host: string | null,
  origin: string | null,
  referer: string | null
): boolean {
  if (!isMutationMethod(method)) {
    return true;
  }

  if (!host) {
    return false;
  }

  const trustedHosts = getConfiguredAppHosts();

  const hostMatchesRequest = (candidateHost: string) =>
    candidateHost === host || trustedHosts.has(candidateHost);

  if (origin) {
    try {
      return hostMatchesRequest(new URL(origin).host);
    } catch {
      return false;
    }
  }

  if (referer) {
    try {
      return hostMatchesRequest(new URL(referer).host);
    } catch {
      return false;
    }
  }

  return allowsMutationWithoutOrigin();
}
