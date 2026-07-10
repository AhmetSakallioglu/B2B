"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";

const RECAPTCHA_BADGE_PATHS = new Set(["/login", "/register"]);

function isAuthRecaptchaRoute(pathname: string) {
  return RECAPTCHA_BADGE_PATHS.has(pathname);
}

function applyRecaptchaBadgeVisibility(show: boolean) {
  document.body.classList.toggle("recaptcha-badge-visible", show);

  const badges = document.querySelectorAll<HTMLElement>(".grecaptcha-badge");

  for (const badge of badges) {
    if (show) {
      badge.style.removeProperty("display");
      badge.style.removeProperty("visibility");
      badge.style.removeProperty("opacity");
      badge.style.removeProperty("pointer-events");
    } else {
      badge.style.setProperty("display", "none", "important");
      badge.style.setProperty("visibility", "hidden", "important");
      badge.style.setProperty("opacity", "0", "important");
      badge.style.setProperty("pointer-events", "none", "important");
    }
  }
}

export function RecaptchaBadgeVisibility() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    const showBadge = isAuthRecaptchaRoute(pathname);
    applyRecaptchaBadgeVisibility(showBadge);

    const observer = new MutationObserver(() => {
      applyRecaptchaBadgeVisibility(showBadge);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      applyRecaptchaBadgeVisibility(false);
    };
  }, [pathname]);

  return null;
}
