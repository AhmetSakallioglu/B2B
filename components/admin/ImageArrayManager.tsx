"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminButton } from "@/components/admin/admin-ui";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ProductCatalogImage } from "@/components/catalog/ProductCatalogImage";
import { ui } from "@/lib/ui-classes";

type ImageArrayManagerProps = {
  images: string[];
  disabled?: boolean;
  emptyHint?: string;
  onSave: (images: string[]) => Promise<void>;
};

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
    return items;
  }

  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function DragHandle() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <circle cx="9" cy="7" r="1.5" />
      <circle cx="15" cy="7" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="17" r="1.5" />
      <circle cx="15" cy="17" r="1.5" />
    </svg>
  );
}

export function ImageArrayManager({
  images,
  disabled = false,
  emptyHint = "Upload images. Drag to reorder before saving.",
  onSave,
}: ImageArrayManagerProps) {
  const [draft, setDraft] = useState<string[]>(images);
  const [pendingPreviews, setPendingPreviews] = useState<
    Array<{ key: string; preview: string; file: File }>
  >([]);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [draggingPendingKey, setDraggingPendingKey] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const syncFromProps = useCallback((nextImages: string[]) => {
    setDraft(nextImages);
    setIsDirty(false);
  }, []);

  useEffect(() => {
    if (!isDirty && pendingPreviews.length === 0) {
      setDraft(images);
    }
  }, [images, isDirty, pendingPreviews.length]);

  const uploadImage = async (file: File) => {
    const uploadData = new FormData();
    uploadData.append("file", file);

    const response = await fetch("/api/admin/upload", {
      method: "POST",
      body: uploadData,
    });

    const data = (await response.json()) as { url?: string; error?: string };

    if (!response.ok) {
      throw new Error(data.error ?? "Failed to upload image");
    }

    return data.url ?? "";
  };

  const handleSelectFiles = (files: FileList | null) => {
    if (!files || disabled || isSaving) {
      return;
    }

    const nextPending = [...pendingPreviews];

    for (const file of Array.from(files)) {
      nextPending.push({
        key: `${file.name}-${file.lastModified}-${Math.random()}`,
        preview: URL.createObjectURL(file),
        file,
      });
    }

    setPendingPreviews(nextPending);
    setIsDirty(true);
  };

  const handleRemoveSaved = (index: number) => {
    setDraft((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setIsDirty(true);
  };

  const handleRemovePending = (key: string) => {
    setPendingPreviews((current) => {
      const next = current.filter((item) => {
        if (item.key === key) {
          URL.revokeObjectURL(item.preview);
        }

        return item.key !== key;
      });

      return next;
    });
    setIsDirty(true);
  };

  const handleSavedDrop = (targetIndex: number) => {
    if (draggingIndex === null || draggingIndex === targetIndex || disabled || isSaving) {
      return;
    }

    setDraft((current) => moveItem(current, draggingIndex, targetIndex));
    setDraggingIndex(null);
    setIsDirty(true);
  };

  const handlePendingDrop = (targetKey: string) => {
    if (!draggingPendingKey || draggingPendingKey === targetKey || disabled) {
      return;
    }

    setPendingPreviews((current) => {
      const fromIndex = current.findIndex((item) => item.key === draggingPendingKey);
      const toIndex = current.findIndex((item) => item.key === targetKey);

      if (fromIndex === -1 || toIndex === -1) {
        return current;
      }

      return moveItem(current, fromIndex, toIndex);
    });
    setDraggingPendingKey(null);
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (disabled || isSaving) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const uploadedUrls: string[] = [];

      for (const pending of pendingPreviews) {
        uploadedUrls.push(await uploadImage(pending.file));
      }

      const nextImages = [...draft, ...uploadedUrls];

      await onSave(nextImages);

      pendingPreviews.forEach((item) => URL.revokeObjectURL(item.preview));
      setPendingPreviews([]);
      setDraft(nextImages);
      setIsDirty(false);
      syncFromProps(nextImages);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save images");
    } finally {
      setIsSaving(false);
    }
  };

  const canReorder = !disabled && !isSaving;
  const totalCount = draft.length + pendingPreviews.length;

  return (
    <div className="space-y-3">
      {totalCount > 1 && (
        <p className={`text-sm ${ui.bodyMuted}`}>Drag images to change display order.</p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {draft.map((url, index) => (
          <div
            key={`${url}-${index}`}
            draggable={canReorder}
            onDragStart={() => setDraggingIndex(index)}
            onDragEnd={() => setDraggingIndex(null)}
            onDragOver={(event) => {
              if (draggingIndex !== null) {
                event.preventDefault();
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              handleSavedDrop(index);
            }}
            className={`overflow-hidden rounded-2xl border border-border bg-surface transition dark:border-border dark:bg-navy ${
              draggingIndex === index ? "opacity-50" : ""
            } ${canReorder ? "cursor-grab active:cursor-grabbing" : ""}`}
          >
            <div className="relative aspect-square bg-cream-dark dark:bg-navy-hover">
              <ProductCatalogImage src={url} alt="Gallery image" className="object-cover" />
              <span className="absolute bottom-2 left-2 rounded-full bg-navy/80 px-2 py-0.5 text-[10px] font-semibold text-cream">
                {index + 1}
              </span>
              {canReorder && (
                <span
                  className="absolute right-2 top-2 rounded-full bg-navy/80 p-1.5 text-cream"
                  aria-hidden="true"
                >
                  <DragHandle />
                </span>
              )}
            </div>
            <div className="p-2">
              <AdminButton
                variant="danger"
                disabled={disabled || isSaving}
                onClick={() => handleRemoveSaved(index)}
                className="w-full"
              >
                Remove
              </AdminButton>
            </div>
          </div>
        ))}

        {pendingPreviews.map((item, index) => (
          <div
            key={item.key}
            draggable={canReorder}
            onDragStart={() => setDraggingPendingKey(item.key)}
            onDragEnd={() => setDraggingPendingKey(null)}
            onDragOver={(event) => {
              if (draggingPendingKey !== null) {
                event.preventDefault();
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              handlePendingDrop(item.key);
            }}
            className={`overflow-hidden rounded-2xl border border-dashed border-border bg-cream-dark dark:border-border dark:bg-navy/60 ${
              draggingPendingKey === item.key ? "opacity-50" : ""
            } ${canReorder ? "cursor-grab active:cursor-grabbing" : ""}`}
          >
            <div className="relative aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.preview}
                alt="Pending gallery image"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <span className="absolute bottom-2 left-2 rounded-full bg-navy/80 px-2 py-0.5 text-[10px] font-semibold text-cream">
                {draft.length + index + 1}
              </span>
            </div>
            <div className="p-2">
              <AdminButton
                variant="danger"
                disabled={disabled || isSaving}
                onClick={() => handleRemovePending(item.key)}
                className="w-full"
              >
                Remove
              </AdminButton>
            </div>
          </div>
        ))}
      </div>

      <input
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled || isSaving}
        onChange={(event) => handleSelectFiles(event.target.files)}
        className="block w-full text-sm text-muted file:mr-4 file:rounded-full file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-medium file:text-white dark:text-cream/75"
      />

      {totalCount === 0 && !isSaving && (
        <p className={`text-sm ${ui.bodyMuted}`}>{emptyHint}</p>
      )}

      {isDirty && (
        <AdminButton
          type="button"
          variant="primary"
          disabled={disabled || isSaving}
          onClick={() => void handleSave()}
        >
          {isSaving ? (
            <span className="inline-flex items-center gap-2">
              <LoadingSpinner size="sm" />
              Saving images...
            </span>
          ) : (
            "Save images"
          )}
        </AdminButton>
      )}

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
