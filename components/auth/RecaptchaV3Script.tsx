import Script from "next/script";
import { RECAPTCHA_SITE_KEY } from "@/lib/recaptcha-constants";

export function RecaptchaV3Script() {
  if (!RECAPTCHA_SITE_KEY) {
    return null;
  }

  return (
    <Script
      src={`https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`}
      strategy="afterInteractive"
    />
  );
}
