"use client";

import { FormEvent, useEffect, useId, useState } from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { ui } from "@/lib/ui-classes";
import { ROOM_TEMPLATE_NAME_MAX_LENGTH } from "@/lib/room-template-validation";

type SaveRoomTemplateModalProps = {
  open: boolean;
  loading?: boolean;
  onConfirm: (templateName: string) => void;
  onCancel: () => void;
};

export function SaveRoomTemplateModal({
  open,
  loading = false,
  onConfirm,
  onCancel,
}: SaveRoomTemplateModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const inputId = useId();
  const [templateName, setTemplateName] = useState("");

  useDeferredEffect(() => {
    if (!open) {
      setTemplateName("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) {
        onCancel();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [loading, onCancel, open]);

  if (!open) {
    return null;
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = templateName.trim();

    if (trimmed.length >= 2) {
      onConfirm(trimmed);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) {
          onCancel();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={`w-full max-w-md p-6 shadow-xl ${ui.adminCard}`}
      >
        <h2 id={titleId} className={ui.heading2}>
          Save Cart as Room Template
        </h2>
        <p id={descriptionId} className={`mt-2 ${ui.bodyMuted}`}>
          Name this cabinet package for quick reordering on multi-unit projects. Current cart
          quantities will be saved as the template baseline.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <label htmlFor={inputId} className={`block ${ui.fieldLabel}`}>
            Template name
          </label>
          <input
            id={inputId}
            type="text"
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value)}
            maxLength={ROOM_TEMPLATE_NAME_MAX_LENGTH}
            placeholder='e.g. "Standard 1+1 Kitchen" or "Type-B Bathroom"'
            autoFocus
            disabled={loading}
            className={ui.input}
          />

          <div className="flex flex-wrap justify-end gap-3 pt-2">
            <button type="button" onClick={onCancel} disabled={loading} className={ui.btnSecondary}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || templateName.trim().length < 2}
              className={ui.btnPrimary}
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" variant="light" />
                  Saving...
                </>
              ) : (
                "Save template"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
