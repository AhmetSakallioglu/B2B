export type IpBanTier = "temporary" | "permanent";

export type IntrusionThreatCategory =
  | "directory_traversal"
  | "sql_injection"
  | "xss"
  | "command_injection"
  | "suspicious_pattern";

export type IntrusionScanResult = {
  blocked: boolean;
  category: IntrusionThreatCategory | null;
  matchedPattern: string | null;
};

export type HoneypotHitEvent = {
  ip: string;
  path: string;
  userAgent: string | null;
};

export type SecurityEventPayload = {
  event: "CRITICAL_HACKING_ATTEMPT" | "IPS_INTRUSION_BLOCKED" | "AUTH_LOCKOUT";
  ip: string;
  path: string;
  category?: IntrusionThreatCategory | "honeypot";
  detail?: string;
  userAgent?: string | null;
};

export type ExponentialBackoffResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  failureCount: number;
};
