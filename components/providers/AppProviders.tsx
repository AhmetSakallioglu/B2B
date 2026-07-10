"use client";

import type { ReactNode } from "react";
import { LogoutConfirmProvider } from "@/components/auth/LogoutConfirmProvider";
import { RecaptchaBadgeVisibility } from "@/components/auth/RecaptchaBadgeVisibility";
import { SessionProvider } from "@/components/auth/SessionProvider";
import { ImpersonationBanner } from "@/components/auth/ImpersonationBanner";
import { CartFeedbackToast } from "@/components/cart/CartFeedbackToast";
import { CartRemoveConfirmProvider } from "@/components/cart/CartRemoveConfirmProvider";
import { AnnouncementProvider } from "@/components/announcement/AnnouncementProvider";
import { ConfirmProvider } from "@/components/ui/ConfirmProvider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ConfirmProvider>
        <LogoutConfirmProvider>
          <CartRemoveConfirmProvider>
            <AnnouncementProvider>
              <RecaptchaBadgeVisibility />
              <ImpersonationBanner />
              {children}
              <CartFeedbackToast />
            </AnnouncementProvider>
          </CartRemoveConfirmProvider>
        </LogoutConfirmProvider>
      </ConfirmProvider>
    </SessionProvider>
  );
}
