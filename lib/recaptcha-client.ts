"use client";

import {
  RECAPTCHA_REGISTER_ACTION,
  RECAPTCHA_SITE_KEY,
} from "@/lib/recaptcha-constants";

type GrecaptchaV3 = {
  ready: (callback: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
};

declare global {
  interface Window {
    grecaptcha?: GrecaptchaV3;
  }
}

function waitForGrecaptcha(timeoutMs = 15000): Promise<GrecaptchaV3> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();

    const attempt = () => {
      if (window.grecaptcha?.execute) {
        resolve(window.grecaptcha);
        return;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error("reCAPTCHA script did not load in time"));
        return;
      }

      window.setTimeout(attempt, 100);
    };

    attempt();
  });
}

export function isRecaptchaV3Configured() {
  return Boolean(RECAPTCHA_SITE_KEY);
}

export async function executeRecaptchaV3(
  action: string = RECAPTCHA_REGISTER_ACTION
): Promise<string | null> {
  const siteKey = RECAPTCHA_SITE_KEY;

  if (!siteKey) {
    console.error("reCAPTCHA Site Key Eksik!");
    return null;
  }

  if (!window.grecaptcha?.execute) {
    await waitForGrecaptcha();
  }

  if (!window.grecaptcha?.execute) {
    throw new Error("reCAPTCHA is not available on window.grecaptcha");
  }

  const grecaptcha = window.grecaptcha;

  return new Promise((resolve, reject) => {
    grecaptcha.ready(() => {
      void grecaptcha
        .execute(siteKey, { action })
        .then(resolve)
        .catch(reject);
    });
  });
}
