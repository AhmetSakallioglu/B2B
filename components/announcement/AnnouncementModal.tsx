"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { ExternalLinkIcon } from "@/components/ui/Icon";
import { ui } from "@/lib/ui-classes";
import type { AnnouncementPublicPayload } from "@/types/announcement";

type AnnouncementModalProps = {
  open: boolean;
  announcement: AnnouncementPublicPayload;
  onClose: () => void;
  onAction?: (href: string) => void;
};

function normalizeInternalPath(href: string) {
  const withoutQuery = href.split("?")[0]?.split("#")[0] ?? href;
  return withoutQuery.replace(/\/+$/, "") || "/";
}

function AnnouncementActionButton({
  label,
  href,
  onAction,
}: {
  label: string;
  href: string;
  onAction?: (href: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onAction?.(href)}
      className={`${ui.btnPrimary} inline-flex items-center gap-2`}
    >
      {label}
      {!href.startsWith("/") && <ExternalLinkIcon size={16} />}
    </button>
  );
}

function PdfAnnouncementContent({
  mediaUrl,
  actionButton,
  onAction,
}: {
  mediaUrl: string;
  actionButton: AnnouncementPublicPayload["actionButton"];
  onAction?: (href: string) => void;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center sm:px-10">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-red-200/80 bg-red-50 text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
        <svg viewBox="0 0 24 24" className="h-10 w-10" fill="currentColor" aria-hidden="true">
          <path d="M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6H6zm7 1.5L18.5 9H13V3.5zM8 13h8v2H8v-2zm0 4h8v2H8v-2z" />
        </svg>
      </div>
      <h2 className={`mt-6 ${ui.heading2}`}>Official announcement available</h2>
      <p className={`mt-2 max-w-md ${ui.bodyMuted}`}>
        Download the latest dealer bulletin as a PDF document.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={() => onAction?.(mediaUrl)} className={ui.btnPrimary}>
          Download Official Announcement (PDF)
        </button>
        {actionButton && (
          <AnnouncementActionButton
            label={actionButton.label}
            href={actionButton.href}
            onAction={onAction}
          />
        )}
      </div>
    </div>
  );
}

function TemplateAnnouncementContent({
  template,
  onAction,
}: {
  template: NonNullable<AnnouncementPublicPayload["template"]>;
  onAction?: (href: string) => void;
}) {
  return (
    <div className="px-6 py-8 sm:px-10 sm:py-10">
      <p className={ui.eyebrow}>Dealer announcement</p>
      <h2 className={`mt-3 ${ui.heading1}`}>{template.title}</h2>
      <p className={`mt-4 whitespace-pre-wrap ${ui.body}`}>{template.description}</p>
      {template.buttonLabel && template.buttonHref && (
        <div className="mt-8">
          <AnnouncementActionButton
            label={template.buttonLabel}
            href={template.buttonHref}
            onAction={onAction}
          />
        </div>
      )}
    </div>
  );
}

export function AnnouncementModal({ open, announcement, onClose, onAction }: AnnouncementModalProps) {
  const titleId = useId();
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);

  const handleAction = (href: string) => {
    if (onAction) {
      onAction(href);
      return;
    }

    const isInternal = href.startsWith("/") && !href.startsWith("//");

    if (isInternal) {
      const currentPath = normalizeInternalPath(window.location.pathname);
      const targetPath = normalizeInternalPath(href);

      if (currentPath === targetPath) {
        onClose();
        return;
      }

      router.push(href);
      onClose();
      return;
    }

    window.open(href, "_blank", "noopener,noreferrer");
    onClose();
  };

  useEffect(() => {
    if (!open) {
      setIsVisible(false);
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setIsVisible(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close announcement"
        className={`absolute inset-0 bg-slate-900/45 backdrop-blur-sm transition-opacity duration-300 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative z-10 w-full max-w-3xl overflow-hidden ${ui.adminCard} shadow-2xl transition-all duration-300 ease-out ${
          isVisible ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-95 opacity-0"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4 dark:border-zinc-700/50 sm:px-6">
          <p id={titleId} className="text-sm font-semibold text-slate-900 dark:text-cream">
            Welcome back
          </p>
          <button
            type="button"
            onClick={onClose}
            className={`${ui.btnSecondary} px-3 py-2 text-xs`}
          >
            Close
          </button>
        </div>

        {announcement.displayMode === "media" &&
        announcement.mediaType === "image" &&
        announcement.mediaUrl ? (
          <>
            <div className="relative max-h-[75vh] w-full bg-slate-950/5 dark:bg-black/20">
              <Image
                src={announcement.mediaUrl}
                alt="Dealer announcement"
                width={1600}
                height={1200}
                className="h-auto max-h-[75vh] w-full object-contain"
                priority
              />
            </div>
            {announcement.actionButton && (
              <div className="border-t border-slate-200/80 px-6 py-5 dark:border-zinc-700/50 sm:px-10">
                <AnnouncementActionButton
                  label={announcement.actionButton.label}
                  href={announcement.actionButton.href}
                  onAction={handleAction}
                />
              </div>
            )}
          </>
        ) : announcement.displayMode === "media" &&
          announcement.mediaType === "pdf" &&
          announcement.mediaUrl ? (
          <PdfAnnouncementContent
            mediaUrl={announcement.mediaUrl}
            actionButton={announcement.actionButton}
            onAction={handleAction}
          />
        ) : announcement.template ? (
          <TemplateAnnouncementContent template={announcement.template} onAction={handleAction} />
        ) : null}
      </div>
    </div>
  );
}

export { normalizeInternalPath };
