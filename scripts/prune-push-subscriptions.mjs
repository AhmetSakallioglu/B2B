import pg from "pg";
import webpush from "web-push";
import https from "node:https";
import tls from "node:tls";
import { readFileSync } from "fs";
import { join } from "path";

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

function buildCaBundle() {
  if (typeof tls.getCACertificates !== "function") {
    return undefined;
  }

  const bundled = tls.getCACertificates();

  try {
    const system = tls.getCACertificates("system");
    return system.length > 0 ? [...bundled, ...system] : bundled;
  } catch {
    return bundled;
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

const agent = new https.Agent({ ca: buildCaBundle(), keepAlive: true });

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://postgres:5454@localhost:5432/cabinet_project",
});

try {
  const result = await pool.query(
    `SELECT id, user_id, endpoint, p256dh, auth_secret FROM admin_push_subscriptions ORDER BY id DESC`
  );

  let removed = 0;

  for (const row of result.rows) {
    try {
      await webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth_secret },
        },
        JSON.stringify({ title: "probe", body: "probe" }),
        { agent, TTL: 0 }
      );
    } catch (error) {
      const statusCode =
        error && typeof error === "object" && "statusCode" in error
          ? Number(error.statusCode)
          : undefined;

      if (statusCode === 404 || statusCode === 410) {
        await pool.query(`DELETE FROM admin_push_subscriptions WHERE id = $1`, [row.id]);
        removed += 1;
        console.log("Removed expired subscription", row.id);
      } else {
        console.log("Subscription", row.id, "is active");
      }
    }
  }

  console.log(`Pruned ${removed} expired subscription(s).`);
} finally {
  await pool.end();
}
