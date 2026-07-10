import { getCompanyProfile } from "@/lib/company-profile";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export type SendEmailResult =
  | { ok: true; skipped?: false; messageId?: string }
  | { ok: true; skipped: true }
  | { ok: false; error: string };

function isEmailTransportConfigured() {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_PORT?.trim() &&
      process.env.EMAIL_FROM?.trim()
  );
}

function resolveEmailFrom() {
  const from = process.env.EMAIL_FROM?.trim();
  const company = getCompanyProfile();

  if (from) {
    return company.name ? `${company.name} <${from}>` : from;
  }

  return from ?? "";
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!isEmailTransportConfigured()) {
    console.info("[email:skipped-not-configured]", {
      to: input.to,
      subject: input.subject,
    });
    return { ok: true, skipped: true };
  }

  try {
    const nodemailer = await import("nodemailer");
    const port = Number.parseInt(process.env.SMTP_PORT ?? "587", 10);
    const secure = process.env.SMTP_SECURE === "true" || port === 465;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure,
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            }
          : undefined,
    });

    const info = await transporter.sendMail({
      from: resolveEmailFrom(),
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text ?? stripHtml(input.html),
    });

    return { ok: true, messageId: info.messageId };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}

function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
