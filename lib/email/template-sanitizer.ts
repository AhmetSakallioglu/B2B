const BLOCKED_TAGS = /<\/?(?:script|iframe|object|embed|form|input|button|link|meta|base)[^>]*>/gi;
const EVENT_HANDLER_ATTR = /\s(on[a-z]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const JAVASCRIPT_URL = /(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi;

export function sanitizeEmailTemplateHtml(html: string) {
  return html
    .replace(BLOCKED_TAGS, "")
    .replace(EVENT_HANDLER_ATTR, "")
    .replace(JAVASCRIPT_URL, "")
    .trim();
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
