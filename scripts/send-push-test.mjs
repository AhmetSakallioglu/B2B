import pg from "pg";
import webpush from "web-push";
import https from "node:https";
import tls from "node:tls";
import { readFileSync } from "fs";
import { join } from "path";

function buildCaBundle() {
  if (typeof tls.getCACertificates !== "function") return undefined;
  const bundled = tls.getCACertificates();
  try {
    const system = tls.getCACertificates("system");
    return system.length > 0 ? [...bundled, ...system] : bundled;
  } catch {
    return bundled;
  }
}

const agent = new https.Agent({ ca: buildCaBundle(), keepAlive: true });

function loadEnvLocal() {
  try {
    const raw = readFileSync(join(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // ignore
  }
}

loadEnvLocal();

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:info@cabinetto.com";

if (!publicKey || !privateKey) {
  console.error("Missing VAPID keys in .env.local");
  process.exit(1);
}

webpush.setVapidDetails(
  subject.startsWith("mailto:") || subject.startsWith("https://") ? subject : `mailto:${subject}`,
  publicKey,
  privateKey
);

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://postgres:5454@localhost:5432/cabinet_project",
});

try {
  const result = await pool.query(
    `SELECT id, user_id, endpoint, p256dh, auth_secret FROM admin_push_subscriptions ORDER BY id DESC LIMIT 5`
  );

  console.log("Subscriptions:", result.rows.length);

  for (const row of result.rows) {
    const payload = JSON.stringify({
      title: "Cabinetto Push Diagnostic",
      body: "If you see this, web push delivery works.",
      icon: "/logo/cabinetto.png",
      tag: "cabinetto-diagnostic",
      url: "/admin",
    });

    console.log("\nSending to subscription", row.id, "user", row.user_id);
    console.log("Endpoint prefix:", row.endpoint.slice(0, 60) + "...");

    try {
      const response = await webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth_secret },
        },
        payload,
        { agent }
      );
      console.log("SUCCESS status:", response.statusCode, response.body);
    } catch (error) {
      console.error("FAILED:");
      if (error && typeof error === "object") {
        console.error("  statusCode:", error.statusCode);
        console.error("  body:", error.body);
        console.error("  message:", error.message);
      } else {
        console.error(error);
      }
    }
  }
} finally {
  await pool.end();
}
