import { NextResponse } from "next/server";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { sanitizeInboundString } from "@/lib/input-sanitization";
import { sanitizeAnnouncementHref } from "@/lib/announcement-template";
import { parseAnnouncementTargetPages } from "@/lib/announcement-targeting";
import {
  parseAnnouncementFrequencyType,
  parseAnnouncementMaxViews,
  parseAnnouncementPriority,
} from "@/lib/announcement-popup-history";
import { parseDisplayDelay } from "@/lib/announcement";
import { logSuspiciousAdminSearchAttempt } from "@/lib/security-audit";
import type { AnnouncementFrequencyType } from "@/types/announcement";
import {
  ADMIN_DATE_PARAM_PATTERN,
  ADMIN_ORDER_LIST_FILTER_VALUES,
  ADMIN_PRODUCT_STOCK_VALUES,
  ADMIN_SEARCH_PARAM_LIMITS,
  ADMIN_USER_STATUS_VALUES,
  type AdminSearchGuardResult,
  type SuspiciousAdminSearchDetection,
} from "@/types/admin-search-sanitization";

const SUSPICIOUS_RAW_PATTERNS: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
  { pattern: /<script[\s>]/i, reason: "xss_script_tag" },
  { pattern: /javascript\s*:/i, reason: "xss_javascript_uri" },
  { pattern: /on(?:error|load|click|mouse(?:over|enter))\s*=/i, reason: "xss_event_handler" },
  { pattern: /union\s+(?:all\s+)?select/i, reason: "sql_union_select" },
  { pattern: /'\s*--/i, reason: "sql_comment_injection" },
  { pattern: /--/, reason: "sql_double_dash" },
  { pattern: /\/\*/, reason: "sql_block_comment_open" },
  { pattern: /\*\//, reason: "sql_block_comment_close" },
  { pattern: /;\s*(?:drop|delete|insert|update|alter|create)\b/i, reason: "sql_chained_statement" },
  { pattern: /(?:^|[\s('"=])or\s+1\s*=\s*1/i, reason: "sql_or_tautology" },
  { pattern: /concat\s*\(/i, reason: "sql_concat" },
  { pattern: /<\/?iframe/i, reason: "xss_iframe_tag" },
  { pattern: /data:text\/html/i, reason: "xss_data_uri" },
];

export function invalidAdminSearchResponse() {
  return NextResponse.json({ error: "Invalid search parameters" }, { status: 400 });
}

export function invalidAnnouncementCampaignResponse(message = "Invalid campaign payload") {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function detectSuspiciousAdminSearchInput(
  param: string,
  rawValue: string
): SuspiciousAdminSearchDetection | null {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    return null;
  }

  for (const { pattern, reason } of SUSPICIOUS_RAW_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        param,
        rawValue: trimmed.slice(0, 500),
        reason,
      };
    }
  }

  return null;
}

export function sanitizeAdminSearchString(
  value: string | null | undefined,
  maxLength: number = ADMIN_SEARCH_PARAM_LIMITS.query
): string {
  if (!value) {
    return "";
  }

  return sanitizeInboundString(value, maxLength);
}

export function parseStrictAdminEnumParam<T extends string>(
  value: string | null | undefined,
  allowed: readonly T[],
  defaultValue: T
): AdminSearchGuardResult<T> {
  const trimmed = value?.trim() ?? "";

  if (!trimmed) {
    return { ok: true, value: defaultValue };
  }

  if (!(allowed as readonly string[]).includes(trimmed)) {
    return { ok: false, response: invalidAdminSearchResponse() };
  }

  return { ok: true, value: trimmed as T };
}

export function parseStrictAdminDateParam(
  value: string | null | undefined,
  paramName: string
): AdminSearchGuardResult<string | null> {
  if (!value?.trim()) {
    return { ok: true, value: null };
  }

  const suspicious = detectSuspiciousAdminSearchInput(paramName, value);

  if (suspicious) {
    return { ok: false, response: invalidAdminSearchResponse() };
  }

  const sanitized = sanitizeInboundString(value, ADMIN_SEARCH_PARAM_LIMITS.date);

  if (!ADMIN_DATE_PARAM_PATTERN.test(sanitized)) {
    return { ok: false, response: invalidAdminSearchResponse() };
  }

  return { ok: true, value: sanitized };
}

export function parseStrictAdminUserIdParam(
  value: string | null | undefined
): AdminSearchGuardResult<number | null> {
  if (!value?.trim()) {
    return { ok: true, value: null };
  }

  const trimmed = value.trim();

  if (!/^\d+$/.test(trimmed)) {
    return { ok: false, response: invalidAdminSearchResponse() };
  }

  const parsed = Number.parseInt(trimmed, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { ok: false, response: invalidAdminSearchResponse() };
  }

  return { ok: true, value: parsed };
}

type AdminSearchParamInput = {
  name: string;
  value: string | null | undefined;
};

type AdminSearchAuditContext = {
  adminUserId: number;
  route: string;
  request: Request;
};

export async function rejectSuspiciousAdminSearchParams(
  context: AdminSearchAuditContext,
  params: AdminSearchParamInput[]
): Promise<NextResponse | null> {
  for (const { name, value } of params) {
    if (value == null || value.trim() === "") {
      continue;
    }

    const detection = detectSuspiciousAdminSearchInput(name, value);

    if (!detection) {
      continue;
    }

    await logSuspiciousAdminSearchAttempt({
      adminUserId: context.adminUserId,
      route: context.route,
      param: detection.param,
      searchTerm: detection.rawValue,
      reason: detection.reason,
      ip: getClientIpFromRequest(context.request),
      userAgent: context.request.headers.get("user-agent"),
    });

    return invalidAdminSearchResponse();
  }

  return null;
}

export async function parseSanitizedAdminUserListQuery(
  request: Request,
  searchParams: URLSearchParams,
  adminUserId: number
) {
  const rawQ = searchParams.get("q");
  const rawStatus = searchParams.get("status");

  const blocked = await rejectSuspiciousAdminSearchParams(
    { adminUserId, route: "/api/admin/users", request },
    [
      { name: "q", value: rawQ },
      { name: "status", value: rawStatus },
    ]
  );

  if (blocked) {
    return { blocked, search: "", status: "all" as const };
  }

  const statusResult = parseStrictAdminEnumParam(
    rawStatus,
    ADMIN_USER_STATUS_VALUES,
    "all"
  );

  if (!statusResult.ok) {
    return { blocked: statusResult.response, search: "", status: "all" as const };
  }

  return {
    blocked: null,
    search: sanitizeAdminSearchString(rawQ, ADMIN_SEARCH_PARAM_LIMITS.query),
    status: statusResult.value,
  };
}

export async function parseSanitizedAdminProductListQuery(
  request: Request,
  searchParams: URLSearchParams,
  adminUserId: number
) {
  const rawQ = searchParams.get("q");
  const rawCategory = searchParams.get("category");
  const rawStock = searchParams.get("stock");
  const rawFinish = searchParams.get("finish");

  const blocked = await rejectSuspiciousAdminSearchParams(
    { adminUserId, route: "/api/admin/products", request },
    [
      { name: "q", value: rawQ },
      { name: "category", value: rawCategory },
      { name: "stock", value: rawStock },
      { name: "finish", value: rawFinish },
    ]
  );

  if (blocked) {
    return {
      blocked,
      search: "",
      category: "",
      stockStatus: "all" as const,
      finishFilter: "",
    };
  }

  const stockResult = parseStrictAdminEnumParam(
    rawStock,
    ADMIN_PRODUCT_STOCK_VALUES,
    "all"
  );

  if (!stockResult.ok) {
    return {
      blocked: stockResult.response,
      search: "",
      category: "",
      stockStatus: "all" as const,
      finishFilter: "",
    };
  }

  return {
    blocked: null,
    search: sanitizeAdminSearchString(rawQ, ADMIN_SEARCH_PARAM_LIMITS.query),
    category: sanitizeAdminSearchString(rawCategory, ADMIN_SEARCH_PARAM_LIMITS.category),
    stockStatus: stockResult.value,
    finishFilter: sanitizeAdminSearchString(rawFinish, ADMIN_SEARCH_PARAM_LIMITS.finish),
  };
}

export async function parseSanitizedAdminProductDeleteScope(
  request: Request,
  searchParams: URLSearchParams,
  adminUserId: number
) {
  const rawScope = searchParams.get("scope");

  const blocked = await rejectSuspiciousAdminSearchParams(
    { adminUserId, route: "/api/admin/products/[variantId]", request },
    [{ name: "scope", value: rawScope }]
  );

  if (blocked) {
    return { blocked, scope: null as string | null };
  }

  if (!rawScope?.trim()) {
    return { blocked: null, scope: null };
  }

  const scopeResult = parseStrictAdminEnumParam(rawScope, ["group"], "group");

  if (!scopeResult.ok) {
    return { blocked: scopeResult.response, scope: null };
  }

  return {
    blocked: null,
    scope: scopeResult.value,
  };
}

export async function parseSanitizedDashboardDateRange(
  request: Request,
  searchParams: URLSearchParams,
  adminUserId: number
) {
  const rawStart = searchParams.get("startDate");
  const rawEnd = searchParams.get("endDate");

  const blocked = await rejectSuspiciousAdminSearchParams(
    { adminUserId, route: "/api/admin/dashboard/stats", request },
    [
      { name: "startDate", value: rawStart },
      { name: "endDate", value: rawEnd },
    ]
  );

  if (blocked) {
    return { blocked, startDate: null as string | null, endDate: null as string | null };
  }

  const startResult = parseStrictAdminDateParam(rawStart, "startDate");

  if (!startResult.ok) {
    return { blocked: startResult.response, startDate: null, endDate: null };
  }

  const endResult = parseStrictAdminDateParam(rawEnd, "endDate");

  if (!endResult.ok) {
    return { blocked: endResult.response, startDate: null, endDate: null };
  }

  return {
    blocked: null,
    startDate: startResult.value,
    endDate: endResult.value,
  };
}

export async function parseSanitizedAdminOrdersListQuery(
  request: Request,
  searchParams: URLSearchParams,
  adminUserId: number
) {
  const rawQ =
    searchParams.get("q") ??
    searchParams.get("search") ??
    searchParams.get("query");
  const rawStatus = searchParams.get("status");
  const rawUserId = searchParams.get("userId");
  const rawStartDate = searchParams.get("startDate");
  const rawEndDate = searchParams.get("endDate");

  const blocked = await rejectSuspiciousAdminSearchParams(
    { adminUserId, route: "/api/admin/orders", request },
    [
      { name: "q", value: rawQ },
      { name: "search", value: searchParams.get("search") },
      { name: "query", value: searchParams.get("query") },
      { name: "status", value: rawStatus },
      { name: "userId", value: rawUserId },
      { name: "startDate", value: rawStartDate },
      { name: "endDate", value: rawEndDate },
    ]
  );

  if (blocked) {
    return {
      blocked,
      search: "",
      status: "all" as const,
      userId: null as number | null,
      startDate: null as string | null,
      endDate: null as string | null,
    };
  }

  const statusResult = parseStrictAdminEnumParam(
    rawStatus,
    ADMIN_ORDER_LIST_FILTER_VALUES,
    "all"
  );

  if (!statusResult.ok) {
    return {
      blocked: statusResult.response,
      search: "",
      status: "all" as const,
      userId: null,
      startDate: null,
      endDate: null,
    };
  }

  const userIdResult = parseStrictAdminUserIdParam(rawUserId);

  if (!userIdResult.ok) {
    return {
      blocked: userIdResult.response,
      search: "",
      status: "all" as const,
      userId: null,
      startDate: null,
      endDate: null,
    };
  }

  const startResult = parseStrictAdminDateParam(rawStartDate, "startDate");

  if (!startResult.ok) {
    return {
      blocked: startResult.response,
      search: "",
      status: "all" as const,
      userId: null,
      startDate: null,
      endDate: null,
    };
  }

  const endResult = parseStrictAdminDateParam(rawEndDate, "endDate");

  if (!endResult.ok) {
    return {
      blocked: endResult.response,
      search: "",
      status: "all" as const,
      userId: null,
      startDate: null,
      endDate: null,
    };
  }

  return {
    blocked: null,
    search: sanitizeAdminSearchString(rawQ, ADMIN_SEARCH_PARAM_LIMITS.query),
    status: statusResult.value,
    userId: userIdResult.value,
    startDate: startResult.value,
    endDate: endResult.value,
  };
}

/** @deprecated Use parseStrictAdminEnumParam */
export function parseAdminEnumParam<T extends string>(
  value: string | null | undefined,
  allowed: readonly T[],
  defaultValue: T
): T {
  const trimmed = value?.trim() ?? "";

  if (!trimmed) {
    return defaultValue;
  }

  return (allowed as readonly string[]).includes(trimmed) ? (trimmed as T) : defaultValue;
}

/** @deprecated Use parseStrictAdminDateParam */
export function sanitizeAdminDateParam(value: string | null | undefined): string | null {
  if (!value?.trim()) {
    return null;
  }

  const sanitized = sanitizeInboundString(value, ADMIN_SEARCH_PARAM_LIMITS.date);

  if (!ADMIN_DATE_PARAM_PATTERN.test(sanitized)) {
    return null;
  }

  return sanitized;
}

export type {
  AdminSearchAuditContext,
  AdminSearchParamInput,
};

export type SanitizedAnnouncementCampaignInput = {
  name: string;
  title: string;
  body: string;
  actionUrl: string | null;
  buttonLabel: string | null;
  targetPages: string[];
  frequencyType: AnnouncementFrequencyType;
  maxViews: number;
  priority: number;
  displayDelay: number;
  isActive: boolean;
};

function readCampaignStringField(body: Record<string, unknown>, key: string) {
  const value = body[key];
  return typeof value === "string" ? value : null;
}

function readCampaignBooleanField(body: Record<string, unknown>, key: string) {
  const value = body[key];

  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true" || value === "1") {
    return true;
  }

  if (value === "false" || value === "0") {
    return false;
  }

  return null;
}

export async function parseSanitizedAnnouncementCampaignBody(
  request: Request,
  adminUserId: number,
  route: string,
  body: unknown,
  options?: {
    displayMode?: "media" | "template";
    requireBody?: boolean;
  }
): Promise<
  | { ok: true; value: SanitizedAnnouncementCampaignInput }
  | { ok: false; response: Response }
> {
  if (!body || typeof body !== "object") {
    return { ok: false, response: invalidAnnouncementCampaignResponse() };
  }

  const candidate = body as Record<string, unknown>;
  const rawName = readCampaignStringField(candidate, "name");
  const rawTitle = readCampaignStringField(candidate, "title");
  const rawBody = readCampaignStringField(candidate, "body");
  const rawActionUrl = readCampaignStringField(candidate, "actionUrl");
  const rawButtonLabel = readCampaignStringField(candidate, "buttonLabel");
  const rawTargetPages = candidate.targetPages;

  const targetPagesRaw =
    typeof rawTargetPages === "string"
      ? rawTargetPages
      : Array.isArray(rawTargetPages)
        ? rawTargetPages.filter((entry): entry is string => typeof entry === "string").join(",")
        : "";

  const blocked = await rejectSuspiciousAdminSearchParams(
    { adminUserId, route, request },
    [
      { name: "name", value: rawName },
      { name: "title", value: rawTitle },
      { name: "body", value: rawBody },
      { name: "actionUrl", value: rawActionUrl },
      { name: "buttonLabel", value: rawButtonLabel },
      { name: "targetPages", value: targetPagesRaw },
    ]
  );

  if (blocked) {
    return { ok: false, response: blocked };
  }

  const name = sanitizeAdminSearchString(rawName, ADMIN_SEARCH_PARAM_LIMITS.campaignName);
  const title = sanitizeAdminSearchString(rawTitle, ADMIN_SEARCH_PARAM_LIMITS.campaignTitle);
  const description = sanitizeAdminSearchString(rawBody, ADMIN_SEARCH_PARAM_LIMITS.campaignBody);
  const buttonLabel = sanitizeAdminSearchString(
    rawButtonLabel,
    ADMIN_SEARCH_PARAM_LIMITS.campaignTitle
  );
  const actionUrl = rawActionUrl?.trim()
    ? sanitizeAnnouncementHref(rawActionUrl.trim())
    : null;

  if (!name || !title) {
    return { ok: false, response: invalidAnnouncementCampaignResponse() };
  }

  const requireBody = options?.requireBody ?? true;

  if (requireBody && !description) {
    return { ok: false, response: invalidAnnouncementCampaignResponse() };
  }

  if (rawActionUrl?.trim() && !actionUrl) {
    return { ok: false, response: invalidAnnouncementCampaignResponse("Invalid action URL") };
  }

  const targetPages = parseAnnouncementTargetPages(
    Array.isArray(rawTargetPages) ? rawTargetPages : targetPagesRaw
  );

  if (!targetPages) {
    return { ok: false, response: invalidAnnouncementCampaignResponse("Invalid target pages") };
  }

  const frequencyType = parseAnnouncementFrequencyType(candidate.frequencyType);

  if (!frequencyType) {
    return { ok: false, response: invalidAnnouncementCampaignResponse("Invalid frequency type") };
  }

  const maxViews = parseAnnouncementMaxViews(candidate.maxViews, frequencyType);

  if (maxViews === null) {
    return { ok: false, response: invalidAnnouncementCampaignResponse("Invalid max views") };
  }

  const priority = parseAnnouncementPriority(candidate.priority);

  if (priority === null) {
    return { ok: false, response: invalidAnnouncementCampaignResponse("Invalid priority score") };
  }

  const displayDelay = parseDisplayDelay(candidate.displayDelay);

  if (displayDelay === null) {
    return { ok: false, response: invalidAnnouncementCampaignResponse("Invalid display delay") };
  }

  const isActive = readCampaignBooleanField(candidate, "isActive");

  if (isActive === null) {
    return { ok: false, response: invalidAnnouncementCampaignResponse("Invalid active state") };
  }

  return {
    ok: true,
    value: {
      name,
      title,
      body: description,
      actionUrl,
      buttonLabel: buttonLabel || null,
      targetPages,
      frequencyType,
      maxViews,
      priority,
      displayDelay,
      isActive,
    },
  };
}
