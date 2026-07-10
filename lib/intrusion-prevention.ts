import type { NextRequest } from "next/server";
import type { IntrusionScanResult, IntrusionThreatCategory } from "@/types/active-defense";

type ThreatPattern = {
  category: IntrusionThreatCategory;
  pattern: RegExp;
};

const THREAT_PATTERNS: ThreatPattern[] = [
  { category: "directory_traversal", pattern: /\.\.(?:\/|\\|%2f|%5c)/i },
  { category: "directory_traversal", pattern: /etc\/passwd/i },
  { category: "directory_traversal", pattern: /proc\/self/i },
  { category: "sql_injection", pattern: /'\s*--/i },
  { category: "sql_injection", pattern: /(?:^|[\s?&])or\s+1\s*=\s*1/i },
  { category: "sql_injection", pattern: /union\s+(?:all\s+)?select/i },
  { category: "sql_injection", pattern: /concat\s*\(/i },
  { category: "sql_injection", pattern: /(?:^|[\s?&])select[\s/*]+.*\bfrom\b/i },
  { category: "sql_injection", pattern: /;\s*(?:drop|delete|insert|update|alter)\b/i },
  { category: "xss", pattern: /<script[\s>]/i },
  { category: "xss", pattern: /javascript\s*:/i },
  { category: "xss", pattern: /on(?:error|load|click)\s*=/i },
  { category: "command_injection", pattern: /\/\*[\s\S]*?\*\//i },
  { category: "suspicious_pattern", pattern: /%00/i },
  { category: "suspicious_pattern", pattern: /base64_decode/i },
];

const SCANNED_HEADER_NAMES = [
  "user-agent",
  "referer",
  "x-forwarded-for",
  "x-original-url",
  "x-rewrite-url",
] as const;

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function scanValue(value: string): IntrusionScanResult {
  const decoded = safeDecode(value);

  for (const threat of THREAT_PATTERNS) {
    if (threat.pattern.test(decoded) || threat.pattern.test(value)) {
      return {
        blocked: true,
        category: threat.category,
        matchedPattern: threat.pattern.source,
      };
    }
  }

  return { blocked: false, category: null, matchedPattern: null };
}

function collectRequestFragments(request: NextRequest): string[] {
  const { pathname, search } = request.nextUrl;
  const fragments = [pathname, search];

  for (const [key, value] of request.nextUrl.searchParams.entries()) {
    fragments.push(key, value);
  }

  for (const headerName of SCANNED_HEADER_NAMES) {
    const headerValue = request.headers.get(headerName);

    if (headerValue) {
      fragments.push(headerValue);
    }
  }

  return fragments;
}

export function scanRequestForIntrusion(request: NextRequest): IntrusionScanResult {
  const fragments = collectRequestFragments(request);

  for (const fragment of fragments) {
    const result = scanValue(fragment);

    if (result.blocked) {
      return result;
    }
  }

  return { blocked: false, category: null, matchedPattern: null };
}

export function createIntrusionBlockedResponse() {
  return new Response(null, {
    status: 400,
    statusText: "Bad Request",
  });
}

export function createIpBannedResponse() {
  return new Response(null, {
    status: 444,
  });
}
