"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnnouncementModal, normalizeInternalPath } from "@/components/announcement/AnnouncementModal";
import { useSession } from "@/components/auth/SessionProvider";
import {
  recordPopupDismissed,
  recordPopupDisplayed,
  selectEligiblePopup,
} from "@/lib/announcement-popup-history";
import { matchesAnnouncementTargetPage } from "@/lib/announcement-targeting";
import { isAdminPage } from "@/lib/route-guard";
import type { AnnouncementPublicPayload } from "@/types/announcement";

function shouldSkipAnnouncementRoute(pathname: string) {
  return (
    isAdminPage(pathname) ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/register/")
  );
}

export function AnnouncementProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isLoading } = useSession();
  const [announcements, setAnnouncements] = useState<AnnouncementPublicPayload[]>([]);
  const [activePopup, setActivePopup] = useState<AnnouncementPublicPayload | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [dismissedPopupIds, setDismissedPopupIds] = useState<number[]>([]);
  const openedPopupIdRef = useRef<number | null>(null);

  const shouldEvaluate = useMemo(() => {
    if (isLoading || !user || user.role !== "customer") {
      return false;
    }

    return !shouldSkipAnnouncementRoute(pathname);
  }, [isLoading, pathname, user]);

  useEffect(() => {
    setDismissedPopupIds([]);
    setActivePopup(null);
    setIsOpen(false);
    openedPopupIdRef.current = null;
  }, [pathname]);

  useEffect(() => {
    if (!shouldEvaluate) {
      setAnnouncements([]);
      setActivePopup(null);
      setIsOpen(false);
      return;
    }

    let cancelled = false;

    const loadAnnouncements = async () => {
      try {
        const response = await fetch(
          `/api/announcement?pathname=${encodeURIComponent(pathname)}`,
          { cache: "no-store" }
        );

        if (!response.ok || cancelled) {
          return;
        }

        const data = (await response.json()) as {
          announcements?: AnnouncementPublicPayload[];
        };

        if (cancelled) {
          return;
        }

        setAnnouncements(data.announcements ?? []);
      } catch {
        // Ignore announcement fetch failures.
      }
    };

    void loadAnnouncements();

    return () => {
      cancelled = true;
    };
  }, [pathname, shouldEvaluate]);

  useEffect(() => {
    if (!shouldEvaluate || announcements.length === 0) {
      setActivePopup(null);
      setIsOpen(false);
      return;
    }

    const nextPopup = selectEligiblePopup(
      announcements,
      pathname,
      dismissedPopupIds,
      matchesAnnouncementTargetPage
    );

    if (!nextPopup) {
      setActivePopup(null);
      setIsOpen(false);
      return;
    }

    setActivePopup(nextPopup);
    setIsOpen(false);
    openedPopupIdRef.current = null;

    const delayMs = Math.max(0, nextPopup.displayDelay) * 1000;
    const timeoutId = window.setTimeout(() => {
      setIsOpen(true);

      if (openedPopupIdRef.current !== nextPopup.id) {
        recordPopupDisplayed(nextPopup);
        openedPopupIdRef.current = nextPopup.id;
      }
    }, delayMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [announcements, dismissedPopupIds, pathname, shouldEvaluate]);

  const handleClose = useCallback(() => {
    if (activePopup) {
      recordPopupDismissed(activePopup);
      setDismissedPopupIds((current) =>
        current.includes(activePopup.id) ? current : [...current, activePopup.id]
      );
    }

    setIsOpen(false);
  }, [activePopup]);

  const handleAction = useCallback(
    (href: string) => {
      const isInternal = href.startsWith("/") && !href.startsWith("//");

      if (isInternal) {
        const currentPath = normalizeInternalPath(window.location.pathname);
        const targetPath = normalizeInternalPath(href);

        if (currentPath === targetPath) {
          handleClose();
          return;
        }
      }

      if (activePopup) {
        recordPopupDismissed(activePopup);
      }

      setIsOpen(false);

      if (isInternal) {
        window.location.assign(href);
        return;
      }

      window.open(href, "_blank", "noopener,noreferrer");
    },
    [activePopup, handleClose]
  );

  return (
    <>
      {children}
      {activePopup && (
        <AnnouncementModal
          open={isOpen}
          announcement={activePopup}
          onClose={handleClose}
          onAction={handleAction}
        />
      )}
    </>
  );
}
