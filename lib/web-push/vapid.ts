import webpush from "web-push";

let vapidConfigured = false;

export function isWebPushConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() &&
      process.env.VAPID_PRIVATE_KEY?.trim()
  );
}

export function getVapidPublicKey() {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? "";
}

export function ensureWebPushConfigured() {
  if (vapidConfigured) {
    return true;
  }

  if (!isWebPushConfigured()) {
    return false;
  }

  const subject =
    process.env.VAPID_SUBJECT?.trim() ||
    process.env.EMAIL_FROM?.trim() ||
    "mailto:admin@cabinetto.local";

  webpush.setVapidDetails(
    subject.startsWith("mailto:") || subject.startsWith("https://")
      ? subject
      : `mailto:${subject}`,
    getVapidPublicKey(),
    process.env.VAPID_PRIVATE_KEY!.trim()
  );

  vapidConfigured = true;
  return true;
}
