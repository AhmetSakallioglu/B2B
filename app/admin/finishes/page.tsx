"use client";

import { FormEvent, useCallback, useState } from "react";
import {
  AdminActionRow,
  AdminAlert,
  AdminBadge,
  AdminButton,
  AdminEmptyState,
  AdminFieldLabel,
  AdminInput,
  AdminListCard,
  AdminListStack,
  AdminPanel,
  AdminTextarea,
} from "@/components/admin/admin-ui";
import { ImageArrayManager } from "@/components/admin/ImageArrayManager";
import { ProductCatalogImage } from "@/components/catalog/ProductCatalogImage";
import { AdminShell } from "@/components/admin/AdminShell";
import { Toast } from "@/components/ui/Toast";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { finishToSlug } from "@/lib/catalog-browse";
import { ui } from "@/lib/ui-classes";
import type { AdminDoorFinish } from "@/types/door-finish";

const EMPTY_FORM = {
  name: "",
  slug: "",
  description: "",
  sortOrder: "0",
  isActive: true,
};

export default function AdminFinishesPage() {
  const { confirm } = useConfirm();
  const [finishes, setFinishes] = useState<AdminDoorFinish[]>([]);
  const [newFinish, setNewFinish] = useState(EMPTY_FORM);
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [editCurrentImageUrl, setEditCurrentImageUrl] = useState<string | null>(null);
  const [removeEditImage, setRemoveEditImage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [togglingFinishId, setTogglingFinishId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedGalleryFinishId, setExpandedGalleryFinishId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; description?: string; variant?: "success" | "error" } | null>(null);

  const saveFinishGallery = async (finish: AdminDoorFinish, images: string[]) => {
    const response = await fetch(`/api/admin/finishes/${finish.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: finish.name,
        slug: finish.slug,
        description: finish.description,
        sortOrder: finish.sortOrder,
        isActive: finish.isActive,
        finishImages: images,
      }),
    });

    const data = (await response.json()) as { error?: string; finish?: AdminDoorFinish };

    if (!response.ok) {
      throw new Error(data.error ?? "Failed to save finish images");
    }

    if (data.finish) {
      setFinishes((current) =>
        current.map((item) => (item.id === finish.id ? data.finish! : item))
      );
    }

    setToast({
      message: "Finish gallery saved",
      description: `${finish.name} images are now shared across all linked variants.`,
      variant: "success",
    });
  };

  const loadFinishes = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/finishes");

      if (!response.ok) {
        throw new Error("Failed to load finishes");
      }

      const data = (await response.json()) as { finishes: AdminDoorFinish[] };
      setFinishes(data.finishes);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load finishes");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useDeferredEffect(() => {
    void loadFinishes();
  }, [loadFinishes]);

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

    return data.url ?? null;
  };

  const handleNewImageChange = (file: File | null) => {
    if (newImagePreview) {
      URL.revokeObjectURL(newImagePreview);
    }

    setNewImageFile(file);
    setNewImagePreview(file ? URL.createObjectURL(file) : null);
  };

  const clearEditImageDraft = () => {
    if (editImagePreview) {
      URL.revokeObjectURL(editImagePreview);
    }

    setEditImageFile(null);
    setEditImagePreview(null);
    setRemoveEditImage(false);
  };

  const handleEditImageChange = (file: File | null) => {
    if (editImagePreview) {
      URL.revokeObjectURL(editImagePreview);
    }

    setEditImageFile(file);
    setEditImagePreview(file ? URL.createObjectURL(file) : null);

    if (file) {
      setRemoveEditImage(false);
    }
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      let sampleImageUrl: string | null = null;

      if (newImageFile) {
        sampleImageUrl = await uploadImage(newImageFile);
      }

      const response = await fetch("/api/admin/finishes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newFinish.name.trim(),
          slug: newFinish.slug.trim() || finishToSlug(newFinish.name),
          description: newFinish.description.trim(),
          sortOrder: Number.parseInt(newFinish.sortOrder, 10) || 0,
          isActive: newFinish.isActive,
          sampleImageUrl,
        }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to create finish");
      }

      setNewFinish(EMPTY_FORM);
      handleNewImageChange(null);
      setMessage("Finish created.");
      await loadFinishes();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to create finish");
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (finish: AdminDoorFinish) => {
    clearEditImageDraft();
    setEditingId(finish.id);
    setEditForm({
      name: finish.name,
      slug: finish.slug,
      description: finish.description,
      sortOrder: String(finish.sortOrder),
      isActive: finish.isActive,
    });
    setEditCurrentImageUrl(finish.sampleImage || null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    clearEditImageDraft();
    setEditCurrentImageUrl(null);
  };

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (editingId === null) {
      return;
    }

    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        name: editForm.name.trim(),
        slug: editForm.slug.trim() || finishToSlug(editForm.name),
        description: editForm.description.trim(),
        sortOrder: Number.parseInt(editForm.sortOrder, 10) || 0,
        isActive: editForm.isActive,
      };

      if (editImageFile) {
        payload.sampleImageUrl = await uploadImage(editImageFile);
      } else if (removeEditImage) {
        const editingFinish = finishes.find((item) => item.id === editingId);
        payload.sampleImageUrl = null;

        if (editingFinish && editCurrentImageUrl) {
          payload.finishImages = editingFinish.finishImages.filter(
            (url) => url !== editCurrentImageUrl
          );
        }
      }

      const response = await fetch(`/api/admin/finishes/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update finish");
      }

      setEditingId(null);
      clearEditImageDraft();
      setEditCurrentImageUrl(null);
      setMessage("Finish updated.");
      await loadFinishes();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to update finish");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (finish: AdminDoorFinish, isActive: boolean) => {
    setTogglingFinishId(finish.id);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/admin/finishes/${finish.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: finish.name,
          slug: finish.slug,
          description: finish.description,
          sortOrder: finish.sortOrder,
          isActive,
        }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update finish status");
      }

      setFinishes((current) =>
        current.map((item) => (item.id === finish.id ? { ...item, isActive } : item))
      );

      setToast({
        message: isActive ? "Finish activated" : "Finish deactivated",
        description: isActive
          ? "All linked variants were set to In Stock."
          : "All linked variants were set to Out of Stock.",
        variant: "success",
      });
    } catch (toggleError) {
      const errorMessage =
        toggleError instanceof Error ? toggleError.message : "Failed to update finish status";
      setError(errorMessage);
      setToast({
        message: "Could not update finish status",
        description: errorMessage,
        variant: "error",
      });
    } finally {
      setTogglingFinishId(null);
    }
  };

  const handleDelete = async (finish: AdminDoorFinish) => {
    const confirmed = await confirm({
      title: "Soft-delete this finish?",
      description:
        "It will be hidden from the catalog but can be restored from Audit Log.",
      confirmLabel: "Soft delete",
      cancelLabel: "Keep finish",
      tone: "warning",
    });

    if (!confirmed) {
      return;
    }

    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/admin/finishes/${finish.id}`, {
        method: "DELETE",
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to delete finish");
      }

      setMessage("Finish deleted.");
      setToast({
        message: "Finish deleted",
        variant: "success",
      });
      await loadFinishes();
    } catch (deleteError) {
      const errorMessage =
        deleteError instanceof Error ? deleteError.message : "Failed to delete finish";
      setError(errorMessage);
      setToast({
        message: "Finish could not be deleted",
        description: errorMessage,
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminShell
      wide
      title="Door Finishes"
      subtitle="Manage catalog door styles such as White Shaker and Grey Shaker"
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <AdminPanel>
          <h2 className={ui.heading3}>Add finish</h2>
          <p className={`mt-2 ${ui.bodyMuted}`}>
            Customers pick a finish first, then browse cabinets in that style.
          </p>

          <form onSubmit={handleCreate} className="mt-6 space-y-4">
            <label className="block space-y-1.5">
              <AdminFieldLabel>Name</AdminFieldLabel>
              <AdminInput
                required
                value={newFinish.name}
                onChange={(event) =>
                  setNewFinish((current) => ({
                    ...current,
                    name: event.target.value,
                    slug: current.slug || finishToSlug(event.target.value),
                  }))
                }
                placeholder="White Shaker"
              />
            </label>
            <label className="block space-y-1.5">
              <AdminFieldLabel>Slug</AdminFieldLabel>
              <AdminInput
                required
                value={newFinish.slug}
                onChange={(event) =>
                  setNewFinish((current) => ({ ...current, slug: event.target.value }))
                }
                placeholder="white-shaker"
              />
            </label>
            <label className="block space-y-1.5">
              <AdminFieldLabel>Description</AdminFieldLabel>
              <AdminTextarea
                rows={3}
                value={newFinish.description}
                onChange={(event) =>
                  setNewFinish((current) => ({ ...current, description: event.target.value }))
                }
              />
            </label>
            <label className="block space-y-1.5">
              <AdminFieldLabel>Sort order</AdminFieldLabel>
              <AdminInput
                type="number"
                value={newFinish.sortOrder}
                onChange={(event) =>
                  setNewFinish((current) => ({ ...current, sortOrder: event.target.value }))
                }
              />
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200/60 bg-slate-50/80 px-3 py-2.5 text-sm text-slate-800 dark:border-zinc-700/50 dark:bg-navy-hover/50 dark:text-cream/90">
              <input
                type="checkbox"
                checked={newFinish.isActive}
                onChange={(event) =>
                  setNewFinish((current) => ({ ...current, isActive: event.target.checked }))
                }
                className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand-ring"
              />
              Active in customer catalog
            </label>
            <div className="space-y-3">
              <AdminFieldLabel>Sample image</AdminFieldLabel>
              <div className="relative aspect-4/3 overflow-hidden rounded-xl border border-dashed border-slate-200/80 bg-white p-3 dark:border-zinc-700/50 dark:bg-navy">
                <ProductCatalogImage
                  src={newImagePreview ?? ""}
                  alt="Finish preview"
                  className="object-cover"
                />
              </div>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => handleNewImageChange(event.target.files?.[0] ?? null)}
                className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-xl file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white file:shadow-sm hover:file:bg-brand-hover dark:text-cream/75"
              />
            </div>
            <AdminButton
              type="submit"
              variant="primary"
              size="md"
              disabled={isSaving}
              className="w-full"
            >
              Add finish
            </AdminButton>
          </form>
        </AdminPanel>

        <AdminPanel>
          <h2 className={ui.heading3}>Finish list</h2>

          {message && <AdminAlert tone="success">{message}</AdminAlert>}
          {error && <AdminAlert tone="error">{error}</AdminAlert>}

          {isLoading ? (
            <p className={`mt-6 ${ui.bodyMuted}`}>Loading finishes...</p>
          ) : finishes.length === 0 ? (
            <AdminEmptyState>No finishes yet.</AdminEmptyState>
          ) : (
            <AdminListStack>
              {finishes.map((finish) => (
                <AdminListCard
                  key={finish.id}
                  className={
                    !finish.isActive
                      ? finish.cartItemsCount > 0
                        ? "border-amber-200/80 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/25"
                        : "border-slate-200/60 bg-slate-50/80 opacity-90 dark:border-zinc-700/50 dark:bg-navy-hover/50"
                      : ""
                  }
                >
                  {editingId === finish.id ? (
                    <form onSubmit={handleUpdate} className="space-y-3">
                      <AdminInput
                        required
                        value={editForm.name}
                        onChange={(event) =>
                          setEditForm((current) => ({ ...current, name: event.target.value }))
                        }
                      />
                      <AdminInput
                        required
                        value={editForm.slug}
                        onChange={(event) =>
                          setEditForm((current) => ({ ...current, slug: event.target.value }))
                        }
                      />
                      <AdminTextarea
                        rows={2}
                        value={editForm.description}
                        onChange={(event) =>
                          setEditForm((current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                      />
                      <AdminInput
                        type="number"
                        value={editForm.sortOrder}
                        onChange={(event) =>
                          setEditForm((current) => ({
                            ...current,
                            sortOrder: event.target.value,
                          }))
                        }
                      />
                      <label className="flex items-center gap-2 rounded-xl border border-slate-200/60 bg-slate-50/80 px-3 py-2.5 text-sm dark:border-zinc-700/50 dark:bg-navy-hover/50 dark:text-cream/90">
                        <input
                          type="checkbox"
                          checked={editForm.isActive}
                          onChange={(event) =>
                            setEditForm((current) => ({
                              ...current,
                              isActive: event.target.checked,
                            }))
                          }
                          className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand-ring"
                        />
                        Active
                      </label>
                      <div className="space-y-3">
                        <AdminFieldLabel>Sample image</AdminFieldLabel>
                        <div className="relative aspect-4/3 overflow-hidden rounded-xl border border-dashed border-slate-200/80 bg-white p-3 dark:border-zinc-700/50 dark:bg-navy">
                          {editImagePreview ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={editImagePreview}
                              alt="New finish preview"
                              className="absolute inset-0 h-full w-full object-cover"
                            />
                          ) : (
                            <ProductCatalogImage
                              src={removeEditImage ? "" : editCurrentImageUrl ?? ""}
                              alt={editForm.name}
                              className="object-cover"
                            />
                          )}
                        </div>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(event) =>
                            handleEditImageChange(event.target.files?.[0] ?? null)
                          }
                          className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-xl file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white file:shadow-sm hover:file:bg-brand-hover dark:text-cream/75"
                        />
                        <div className="flex flex-wrap gap-2">
                          {editCurrentImageUrl && !editImagePreview && (
                            <AdminButton
                              type="button"
                              variant={removeEditImage ? "primary" : "ghost"}
                              onClick={() => setRemoveEditImage((current) => !current)}
                            >
                              {removeEditImage ? "Undo remove image" : "Remove current image"}
                            </AdminButton>
                          )}
                          {editImagePreview && (
                            <AdminButton
                              type="button"
                              variant="ghost"
                              onClick={() => handleEditImageChange(null)}
                            >
                              Cancel new image
                            </AdminButton>
                          )}
                        </div>
                      </div>
                      <div className="space-y-3 border-t border-slate-200/60 pt-4 dark:border-zinc-700/50">
                        <AdminFieldLabel>Manage finish images</AdminFieldLabel>
                        <p className={`text-sm ${ui.bodyMuted}`}>
                          Lifestyle and door texture photos shared by every variant in this finish.
                        </p>
                        <ImageArrayManager
                          images={finish.finishImages}
                          disabled={isSaving}
                          emptyHint="Upload kitchen or door photos for this finish."
                          onSave={(images) => saveFinishGallery(finish, images)}
                        />
                      </div>
                      <AdminActionRow>
                        <AdminButton type="submit" variant="primary" disabled={isSaving}>
                          Save
                        </AdminButton>
                        <AdminButton type="button" onClick={cancelEdit}>
                          Cancel
                        </AdminButton>
                      </AdminActionRow>
                    </form>
                  ) : (
                    <div className="flex gap-4">
                      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-slate-200/60 bg-white p-1.5 dark:border-zinc-700/50 dark:bg-navy">
                        <ProductCatalogImage
                          src={finish.sampleImage}
                          alt={finish.name}
                          sizes="96px"
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-cream">
                              {finish.name}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-cream/60">
                              {finish.slug} · sort {finish.sortOrder}
                            </p>
                          </div>
                          <AdminBadge tone={finish.isActive ? "success" : "neutral"}>
                            {finish.isActive ? "Active" : "Inactive"}
                          </AdminBadge>
                        </div>
                        {finish.description && (
                          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-cream/75">
                            {finish.description}
                          </p>
                        )}
                        <p className="mt-2 text-sm text-slate-500 dark:text-cream/60">
                          {finish.variantCount} catalog variant{finish.variantCount === 1 ? "" : "s"}
                          {!finish.isActive && finish.cartItemsCount > 0 && (
                            <span className="ml-2 font-medium text-amber-700 dark:text-amber-300">
                              · {finish.cartItemsCount} item{finish.cartItemsCount === 1 ? "" : "s"} in customer carts
                            </span>
                          )}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-4">
                          <ToggleSwitch
                            checked={finish.isActive}
                            disabled={togglingFinishId === finish.id || isSaving}
                            label={finish.isActive ? "Active" : "Inactive"}
                            onChange={(isActive) => void handleToggleActive(finish, isActive)}
                          />
                        </div>
                        <AdminActionRow>
                          <AdminButton type="button" onClick={() => startEdit(finish)}>
                            Edit
                          </AdminButton>
                          <AdminButton
                            type="button"
                            onClick={() =>
                              setExpandedGalleryFinishId((current) =>
                                current === finish.id ? null : finish.id
                              )
                            }
                          >
                            {expandedGalleryFinishId === finish.id
                              ? "Hide finish images"
                              : "Manage finish images"}
                          </AdminButton>
                          <AdminButton
                            type="button"
                            variant="danger"
                            disabled={isSaving}
                            onClick={() => void handleDelete(finish)}
                          >
                            Delete
                          </AdminButton>
                        </AdminActionRow>
                        {expandedGalleryFinishId === finish.id && (
                          <div className="mt-4 space-y-3 rounded-xl border border-slate-200/60 bg-white/80 p-4 dark:border-zinc-700/50 dark:bg-navy/70">
                            <p className={`text-sm ${ui.bodyMuted}`}>
                              {finish.finishImages.length} shared image
                              {finish.finishImages.length === 1 ? "" : "s"} for all {finish.name}{" "}
                              variants.
                            </p>
                            <ImageArrayManager
                              images={finish.finishImages}
                              disabled={isSaving}
                              emptyHint="Upload kitchen or door photos for this finish."
                              onSave={(images) => saveFinishGallery(finish, images)}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </AdminListCard>
              ))}
            </AdminListStack>
          )}
        </AdminPanel>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          description={toast.description}
          variant={toast.variant ?? "success"}
          onClose={() => setToast(null)}
        />
      )}
    </AdminShell>
  );
}
