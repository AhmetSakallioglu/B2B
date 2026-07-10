import https from "node:https";
import tls from "node:tls";

type TlsWithSystemCa = typeof tls & {
  getCACertificates?: (type?: "default" | "system") => string[] | Buffer[];
};

let cachedAgent: https.Agent | undefined;

function buildCaBundle() {
  const tlsApi = tls as TlsWithSystemCa;

  if (typeof tlsApi.getCACertificates !== "function") {
    return undefined;
  }

  const bundled = tlsApi.getCACertificates();

  try {
    const system = tlsApi.getCACertificates("system");

    if (!system.length) {
      return bundled;
    }

    return [...bundled, ...system];
  } catch {
    return bundled;
  }
}

/** FCM/web-push on Windows often fails TLS verify without the OS CA store. */
export function getWebPushHttpsAgent() {
  if (cachedAgent) {
    return cachedAgent;
  }

  const ca = buildCaBundle();

  cachedAgent = new https.Agent({
    ca,
    keepAlive: true,
  });

  return cachedAgent;
}
