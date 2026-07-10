import {
  RECAPTCHA_BOT_DETECTED_MESSAGE,
  RECAPTCHA_MIN_SCORE,
  RECAPTCHA_REGISTER_ACTION,
} from "@/lib/recaptcha-constants";

type RecaptchaSiteVerifyResponse = {
  success?: boolean;
  score?: number;
  action?: string;
  "error-codes"?: string[];
};

export type RecaptchaVerificationResult =
  | { ok: true; score: number }
  | { ok: false; reason: "skipped" | "missing_token" | "verification_failed" | "low_score" };

export function isRecaptchaConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY && process.env.RECAPTCHA_SECRET_KEY
  );
}

export async function verifyRecaptchaToken(
  token: string | null | undefined,
  expectedAction: string = RECAPTCHA_REGISTER_ACTION
): Promise<RecaptchaVerificationResult> {
  if (!isRecaptchaConfigured()) {
    return { ok: true, score: 1 };
  }

  if (!token || typeof token !== "string" || !token.trim()) {
    return { ok: false, reason: "missing_token" };
  }

  try {
    const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: process.env.RECAPTCHA_SECRET_KEY!,
        response: token,
      }),
    });

    if (!response.ok) {
      return { ok: false, reason: "verification_failed" };
    }

    const payload = (await response.json()) as RecaptchaSiteVerifyResponse;

    if (payload.success !== true) {
      return { ok: false, reason: "verification_failed" };
    }

    if (payload.action && payload.action !== expectedAction) {
      return { ok: false, reason: "verification_failed" };
    }

    const score = typeof payload.score === "number" ? payload.score : 0;

    if (score < RECAPTCHA_MIN_SCORE) {
      return { ok: false, reason: "low_score" };
    }

    return { ok: true, score };
  } catch {
    return { ok: false, reason: "verification_failed" };
  }
}

export function getRecaptchaErrorMessage(result: RecaptchaVerificationResult) {
  if (result.ok) {
    return null;
  }

  if (result.reason === "low_score") {
    return RECAPTCHA_BOT_DETECTED_MESSAGE;
  }

  return "reCAPTCHA verification failed. Please try again.";
}

export { RECAPTCHA_BOT_DETECTED_MESSAGE, RECAPTCHA_MIN_SCORE, RECAPTCHA_REGISTER_ACTION };
