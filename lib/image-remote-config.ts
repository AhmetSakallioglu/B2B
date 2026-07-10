type RemotePattern = {
  protocol: "https" | "http";
  hostname: string;
  pathname?: string;
};

const DEFAULT_REMOTE_HOSTS = [
  "images.unsplash.com",
  "res.cloudinary.com",
  "cdn.cloudinary.com",
  "imagedelivery.net",
  "*.blob.vercel-storage.com",
] as const;

function parseHostnamePattern(value: string): RemotePattern | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  try {
    if (trimmed.includes("://")) {
      const parsed = new URL(trimmed);
      return {
        protocol: parsed.protocol === "http:" ? "http" : "https",
        hostname: parsed.hostname,
        pathname: parsed.pathname !== "/" ? `${parsed.pathname}**` : undefined,
      };
    }

    return {
      protocol: "https",
      hostname: trimmed,
    };
  } catch {
    return null;
  }
}

export function getConfiguredRemoteImageHosts(): string[] {
  const fromEnv = (process.env.IMAGE_REMOTE_HOSTS ?? process.env.NEXT_PUBLIC_IMAGE_REMOTE_HOSTS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const hosts = new Set<string>([...DEFAULT_REMOTE_HOSTS, ...fromEnv]);

  if (process.env.NEXT_PUBLIC_APP_URL) {
    try {
      hosts.add(new URL(process.env.NEXT_PUBLIC_APP_URL).hostname);
    } catch {
      // Ignore malformed APP URL.
    }
  }

  return Array.from(hosts);
}

export function getNextImageRemotePatterns(): RemotePattern[] {
  const patterns = getConfiguredRemoteImageHosts()
    .map(parseHostnamePattern)
    .filter((pattern): pattern is RemotePattern => pattern !== null);

  const unique = new Map<string, RemotePattern>();

  for (const pattern of patterns) {
    unique.set(`${pattern.protocol}:${pattern.hostname}`, pattern);
  }

  return Array.from(unique.values());
}

export function getAllowedRemoteImageHosts(): Set<string> {
  return new Set(
    getConfiguredRemoteImageHosts().map((host) => host.replace(/^\*\./, "").toLowerCase())
  );
}

export function isAllowedRemoteImageHostname(hostname: string) {
  const normalized = hostname.toLowerCase();

  for (const pattern of getConfiguredRemoteImageHosts()) {
    const host = pattern.trim().toLowerCase();

    if (!host) {
      continue;
    }

    if (host.startsWith("*.")) {
      const suffix = host.slice(1);

      if (normalized.endsWith(suffix) || normalized === host.slice(2)) {
        return true;
      }

      continue;
    }

    if (normalized === host) {
      return true;
    }

    if (host.startsWith("pub-") && host.endsWith(".r2.dev") && normalized.endsWith(".r2.dev")) {
      return true;
    }
  }

  return false;
}
