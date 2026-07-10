"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AdminButton } from "@/components/admin/admin-ui";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { LoadingState } from "@/components/ui/LoadingState";
import { ProductCatalogImage } from "@/components/catalog/ProductCatalogImage";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import type { ProductImage } from "@/types/catalog";

type PendingImage = {
  key: string;
  file: File;
  preview: string;
  isCover: boolean;
};

type ProductImageManagerProps = {
  finishId: number;
  finishName: string;
  productId?: number;
  disabled?: boolean;
  hideFinishHeading?: boolean;
  onPendingChange?: (images: PendingImage[]) => void;
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
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <circle cx="9" cy="7" r="1.5" />
      <circle cx="15" cy="7" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="17" r="1.5" />
      <circle cx="15" cy="17" r="1.5" />
    </svg>
  );
}

export function ProductImageManager({
  finishId,
  finishName,
  productId,
  disabled = false,
  hideFinishHeading = false,
  onPendingChange,
}: ProductImageManagerProps) {
  const [savedImages, setSavedImages] = useState<ProductImage[]>([]);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(productId));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggingSavedId, setDraggingSavedId] = useState<number | null>(null);
  const [draggingPendingKey, setDraggingPendingKey] = useState<string | null>(null);
  const onPendingChangeRef = useRef(onPendingChange);

  useEffect(() => {
    onPendingChangeRef.current = onPendingChange;
  }, [onPendingChange]);

  useEffect(() => {
    onPendingChangeRef.current?.(pendingImages);
  }, [pendingImages]);

  const loadImages = useCallback(async () => {
    if (!productId) {
      setSavedImages([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/product-images?productId=${productId}&finishId=${finishId}`
      );

      if (!response.ok) {
        throw new Error("Failed to load product images");
      }

      const data = (await response.json()) as { images: ProductImage[] };
      setSavedImages(data.images);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load images");
    } finally {
      setIsLoading(false);
    }
  }, [productId, finishId]);

  useDeferredEffect(() => {
    void loadImages();
  }, [loadImages]);

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

  const persistSavedOrder = async (imageIds: number[], previousOrder: ProductImage[]) => {
    if (!productId) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/product-images", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, finishId, imageIds }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to reorder images");
      }

      const data = (await response.json()) as { images: ProductImage[] };
      setSavedImages(data.images);
    } catch (saveError) {
      setSavedImages(previousOrder);
      setError(saveError instanceof Error ? saveError.message : "Failed to reorder images");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavedDrop = (targetId: number) => {
    if (!draggingSavedId || draggingSavedId === targetId || disabled || isSaving) {
      return;
    }

    const fromIndex = savedImages.findIndex((image) => image.id === draggingSavedId);
    const toIndex = savedImages.findIndex((image) => image.id === targetId);

    if (fromIndex === -1 || toIndex === -1) {
      return;
    }

    const previousOrder = savedImages;
    const nextOrder = moveItem(savedImages, fromIndex, toIndex);

    setSavedImages(nextOrder);
    setDraggingSavedId(null);
    void persistSavedOrder(
      nextOrder.map((image) => image.id),
      previousOrder
    );
  };

  const handlePendingDrop = (targetKey: string) => {
    if (!draggingPendingKey || draggingPendingKey === targetKey || disabled) {
      return;
    }

    const fromIndex = pendingImages.findIndex((image) => image.key === draggingPendingKey);
    const toIndex = pendingImages.findIndex((image) => image.key === targetKey);

    if (fromIndex === -1 || toIndex === -1) {
      return;
    }

    setPendingImages(moveItem(pendingImages, fromIndex, toIndex));
    setDraggingPendingKey(null);
  };

  const handleSelectFiles = (files: FileList | null) => {
    if (!files || disabled) {
      return;
    }

    const nextPending = [...pendingImages];

    for (const file of Array.from(files)) {
      nextPending.push({
        key: `${file.name}-${file.lastModified}-${Math.random()}`,
        file,
        preview: URL.createObjectURL(file),
        isCover: false,
      });
    }

    if (!savedImages.some((image) => image.isCover) && nextPending.every((image) => !image.isCover)) {
      nextPending[0].isCover = true;
    }

    setPendingImages(nextPending);
  };

  const handleUploadPending = async () => {
    if (!productId || pendingImages.length === 0 || disabled) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      for (const pending of pendingImages) {
        const imageUrl = await uploadImage(pending.file);
        const response = await fetch("/api/admin/product-images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId,
            finishId,
            imageUrl,
            asCover: pending.isCover,
          }),
        });

        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          throw new Error(data.error ?? "Failed to save image");
        }
      }

      pendingImages.forEach((image) => URL.revokeObjectURL(image.preview));
      setPendingImages([]);
      await loadImages();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to upload images");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetCover = async (imageId: number) => {
    if (!productId || disabled) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/product-images/${imageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCover: true }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to set cover image");
      }

      const data = (await response.json()) as { images: ProductImage[] };
      setSavedImages(data.images);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to set cover image");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSaved = async (imageId: number) => {
    if (!productId || disabled) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/product-images/${imageId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to delete image");
      }

      const data = (await response.json()) as { images: ProductImage[] };
      setSavedImages(data.images);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete image");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetPendingCover = (key: string) => {
    setPendingImages((current) =>
      current.map((image) => ({
        ...image,
        isCover: image.key === key,
      }))
    );
  };

  const handleRemovePending = (key: string) => {
    setPendingImages((current) => {
      const next = current.filter((image) => {
        if (image.key === key) {
          URL.revokeObjectURL(image.preview);
        }

        return image.key !== key;
      });

      if (next.length > 0 && !next.some((image) => image.isCover)) {
        next[0].isCover = true;
      }

      return next;
    });
  };

  const canReorder = !disabled && !isSaving;
  const hasMultipleImages = savedImages.length + pendingImages.length > 1;

  return (
    <div className="space-y-3">
      {!hideFinishHeading && (
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          {finishName} images
        </span>
      )}

      {hasMultipleImages && (
        <p className="text-sm text-muted dark:text-cream/70">
          Drag images to change display order on the product page.
        </p>
      )}

      {isLoading ? (
        <LoadingState label="Loading images..." minHeight="min-h-32" spinnerSize="sm" />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {savedImages.map((image, index) => (
            <div
              key={image.id}
              draggable={canReorder}
              onDragStart={() => setDraggingSavedId(image.id)}
              onDragEnd={() => setDraggingSavedId(null)}
              onDragOver={(event) => {
                if (draggingSavedId !== null) {
                  event.preventDefault();
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                handleSavedDrop(image.id);
              }}
              className={`overflow-hidden rounded-2xl border border-border bg-surface transition dark:border-border dark:bg-navy ${
                draggingSavedId === image.id ? "opacity-50" : ""
              } ${canReorder ? "cursor-grab active:cursor-grabbing" : ""}`}
            >
              <div className="relative aspect-square bg-cream-dark dark:bg-navy-hover">
                <ProductCatalogImage src={image.url} alt="Product image" className="object-cover" />
                <span className="absolute left-2 bottom-2 rounded-full bg-navy/80 px-2 py-0.5 text-[10px] font-semibold text-cream">
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
                {image.isCover && (
                  <span className="absolute left-2 top-2 rounded-full bg-brand px-2 py-0.5 text-[9px] font-semibold uppercase text-white">
                    Cover
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1.5 p-2">
                {!image.isCover && (
                  <AdminButton
                    disabled={disabled || isSaving}
                    onClick={() => handleSetCover(image.id)}
                    className="w-full"
                  >
                    Set cover
                  </AdminButton>
                )}
                <AdminButton
                  variant="danger"
                  disabled={disabled || isSaving}
                  onClick={() => handleDeleteSaved(image.id)}
                  className="w-full"
                >
                  Remove
                </AdminButton>
              </div>
            </div>
          ))}

          {pendingImages.map((image, index) => (
            <div
              key={image.key}
              draggable={canReorder}
              onDragStart={() => setDraggingPendingKey(image.key)}
              onDragEnd={() => setDraggingPendingKey(null)}
              onDragOver={(event) => {
                if (draggingPendingKey !== null) {
                  event.preventDefault();
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                handlePendingDrop(image.key);
              }}
              className={`overflow-hidden rounded-2xl border border-dashed border-border bg-cream-dark dark:border-border dark:bg-navy/60 ${
                draggingPendingKey === image.key ? "opacity-50" : ""
              } ${canReorder ? "cursor-grab active:cursor-grabbing" : ""}`}
            >
              <div className="relative aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.preview}
                  alt="Pending product image"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <span className="absolute left-2 bottom-2 rounded-full bg-navy/80 px-2 py-0.5 text-[10px] font-semibold text-cream">
                  {savedImages.length + index + 1}
                </span>
                {canReorder && (
                  <span
                    className="absolute right-2 top-2 rounded-full bg-navy/80 p-1.5 text-cream"
                    aria-hidden="true"
                  >
                    <DragHandle />
                  </span>
                )}
                {image.isCover && (
                  <span className="absolute left-2 top-2 rounded-full bg-brand px-2 py-0.5 text-[9px] font-semibold uppercase text-white">
                    Cover
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1.5 p-2">
                {!image.isCover && (
                  <AdminButton
                    disabled={disabled}
                    onClick={() => handleSetPendingCover(image.key)}
                    className="w-full"
                  >
                    Set cover
                  </AdminButton>
                )}
                <AdminButton
                  variant="danger"
                  disabled={disabled}
                  onClick={() => handleRemovePending(image.key)}
                  className="w-full"
                >
                  Remove
                </AdminButton>
              </div>
            </div>
          ))}
        </div>
      )}

      <input
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled || isSaving}
        onChange={(event) => handleSelectFiles(event.target.files)}
        className="block w-full text-sm text-muted file:mr-4 file:rounded-full file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-medium file:text-white dark:text-cream/75"
      />

      {productId && pendingImages.length > 0 && (
        <button
          type="button"
          disabled={disabled || isSaving}
          onClick={handleUploadPending}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium dark:border-border"
        >
          {isSaving ? (
            <>
              <LoadingSpinner size="sm" />
              Uploading images...
            </>
          ) : (
            `Upload ${pendingImages.length} selected image(s)`
          )}
        </button>
      )}

      {!productId && pendingImages.length === 0 && (
        <p className="text-sm text-muted dark:text-cream/70">
          Select one or more images. Drag to reorder before saving. The cover image appears in the catalog.
        </p>
      )}

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

export type { PendingImage };
