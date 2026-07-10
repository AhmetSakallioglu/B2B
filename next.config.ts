import type { NextConfig } from "next";
import { getNextImageRemotePatterns } from "@/lib/image-remote-config";

const isProduction = process.env.NODE_ENV === "production";

const remoteImageHosts = getNextImageRemotePatterns()
  .map((pattern) => pattern.hostname)
  .filter((hostname) => !hostname.includes("*"));

const imgSrcHosts = Array.from(
  new Set([
    "https://images.unsplash.com",
    "https://www.gstatic.com",
    "https://*.blob.vercel-storage.com",
    ...remoteImageHosts.map((hostname) => `https://${hostname}`),
  ])
);

/** Google reCAPTCHA v3 — script, iframe, and API calls */
const recaptchaScriptSrc = [
  "'self'",
  "'unsafe-inline'",
  ...(isProduction ? [] : ["'unsafe-eval'"]),
  "https://www.google.com",
  "https://www.gstatic.com",
].join(" ");

const recaptchaFrameSrc = ["'self'", "https://www.google.com", "https://recaptcha.google.com"].join(
  " "
);

const recaptchaConnectSrc = ["'self'", "https://www.google.com", "https://www.gstatic.com"].join(
  " "
);

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src ${recaptchaScriptSrc}`,
  "style-src 'self' 'unsafe-inline' https://www.google.com https://www.gstatic.com",
  `img-src 'self' data: blob: ${imgSrcHosts.join(" ")}`,
  "font-src 'self' https://www.gstatic.com",
  `connect-src ${recaptchaConnectSrc}`,
  "worker-src 'self'",
  `frame-src ${recaptchaFrameSrc}`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  ...(isProduction ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  ...(isProduction
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: getNextImageRemotePatterns(),
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
