"use client";

import { useEffect } from "react";

type RegisterRecaptchaEnvCheckProps = {
  siteKey: string;
};

export function RegisterRecaptchaEnvCheck({ siteKey }: RegisterRecaptchaEnvCheckProps) {
  useEffect(() => {
    if (!siteKey) {
      console.error("reCAPTCHA Site Key Eksik!");
    }
  }, [siteKey]);

  return null;
}
