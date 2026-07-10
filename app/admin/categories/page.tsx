"use client";

import Link from "next/link";
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
} from "@/components/admin/admin-ui";
import { AdminShell } from "@/components/admin/AdminShell";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { finishToSlug } from "@/lib/catalog-browse";
import type { AdminCategory, AdminSubCategory } from "@/types/category-admin";

const EMPTY_CATEGORY_FORM = {
  name: "",
  slug: "",
};

const EMPTY_SUBCATEGORY_FORM = {
  name: "",
  slug: "",
};

export default function AdminCategoriesPage() {
  const { confirm } = useConfirm();
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [newCategory, setNewCategory] = useState(EMPTY_CATEGORY_FORM);
  const [newSubCategoryByCategory, setNewSubCategoryByCategory] = useState<
    Record<number, typeof EMPTY_SUBCATEGORY_FORM>
  >({});
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editCategoryForm, setEditCategoryForm] = useState(EMPTY_CATEGORY_FORM);
  const [editingSubCategoryId, setEditingSubCategoryId] = useState<number | null>(null);
  const [editSubCategoryForm, setEditSubCategoryForm] = useState({
    ...EMPTY_SUBCATEGORY_FORM,
    categoryId: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/categories");

      if (!response.ok) {
        throw new Error("Failed to load categories");
      }

      const data = (await response.json()) as { categories: AdminCategory[] };
      setCategories(data.categories);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load categories");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useDeferredEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const getSubCategoryForm = (categoryId: number) =>
    newSubCategoryByCategory[categoryId] ?? EMPTY_SUBCATEGORY_FORM;

  const updateSubCategoryForm = (
    categoryId: number,
    updates: Partial<typeof EMPTY_SUBCATEGORY_FORM>
  ) => {
    setNewSubCategoryByCategory((current) => ({
      ...current,
      [categoryId]: {
        ...getSubCategoryForm(categoryId),
        ...updates,
      },
    }));
  };

  const handleCreateCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCategory.name.trim(),
          slug: newCategory.slug.trim() || finishToSlug(newCategory.name),
        }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to create category");
      }

      setNewCategory(EMPTY_CATEGORY_FORM);
      setMessage("Category created.");
      await loadCategories();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to create category");
    } finally {
      setIsSaving(false);
    }
  };

  const startEditCategory = (category: AdminCategory) => {
    setEditingCategoryId(category.id);
    setEditingSubCategoryId(null);
    setEditCategoryForm({
      name: category.name,
      slug: category.slug,
    });
  };

  const handleUpdateCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (editingCategoryId === null) {
      return;
    }

    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/admin/categories/${editingCategoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editCategoryForm.name.trim(),
          slug: editCategoryForm.slug.trim() || finishToSlug(editCategoryForm.name),
        }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update category");
      }

      setEditingCategoryId(null);
      setMessage("Category updated.");
      await loadCategories();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to update category");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCategory = async (category: AdminCategory) => {
    const confirmed = await confirm({
      title: `Delete "${category.name}"?`,
      description:
        "This will permanently delete the category and all of its subcategories. This cannot be undone.",
      confirmLabel: "Delete permanently",
      cancelLabel: "Keep category",
      tone: "danger",
    });

    if (!confirmed) {
      return;
    }

    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/admin/categories/${category.id}`, {
        method: "DELETE",
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to delete category");
      }

      setMessage("Category deleted.");
      await loadCategories();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete category");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateSubCategory = async (
    event: FormEvent<HTMLFormElement>,
    categoryId: number
  ) => {
    event.preventDefault();
    const form = getSubCategoryForm(categoryId);

    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/subcategories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId,
          name: form.name.trim(),
          slug: form.slug.trim() || finishToSlug(form.name),
        }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to create subcategory");
      }

      setNewSubCategoryByCategory((current) => {
        const next = { ...current };
        delete next[categoryId];
        return next;
      });
      setMessage("Subcategory created.");
      await loadCategories();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to create subcategory"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const startEditSubCategory = (categoryId: number, subCategory: AdminSubCategory) => {
    setEditingSubCategoryId(subCategory.id);
    setEditingCategoryId(null);
    setEditSubCategoryForm({
      name: subCategory.name,
      slug: subCategory.slug,
      categoryId: String(categoryId),
    });
  };

  const handleUpdateSubCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (editingSubCategoryId === null) {
      return;
    }

    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/admin/subcategories/${editingSubCategoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: Number.parseInt(editSubCategoryForm.categoryId, 10),
          name: editSubCategoryForm.name.trim(),
          slug:
            editSubCategoryForm.slug.trim() || finishToSlug(editSubCategoryForm.name),
        }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update subcategory");
      }

      setEditingSubCategoryId(null);
      setMessage("Subcategory updated.");
      await loadCategories();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to update subcategory"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSubCategory = async (subCategory: AdminSubCategory) => {
    const confirmed = await confirm({
      title: `Delete "${subCategory.name}"?`,
      description: "This subcategory will be permanently removed. This cannot be undone.",
      confirmLabel: "Delete subcategory",
      cancelLabel: "Keep subcategory",
      tone: "danger",
    });

    if (!confirmed) {
      return;
    }

    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/admin/subcategories/${subCategory.id}`, {
        method: "DELETE",
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to delete subcategory");
      }

      setMessage("Subcategory deleted.");
      await loadCategories();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Failed to delete subcategory"
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminShell
      wide
      title="Categories"
      subtitle="Manage product categories and subcategories used across the catalog and admin forms"
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <AdminPanel>
          <h2 className="text-lg font-semibold text-navy dark:text-cream">Add category</h2>
          <p className="mt-2 text-sm text-muted dark:text-cream/70">
            Create a top-level category first, then add subcategories from the list.
          </p>

          <form onSubmit={handleCreateCategory} className="mt-6 space-y-4">
            <label className="block space-y-1.5">
              <AdminFieldLabel>Name</AdminFieldLabel>
              <AdminInput
                required
                value={newCategory.name}
                onChange={(event) => {
                  const name = event.target.value;
                  setNewCategory((current) => ({
                    name,
                    slug: current.slug || finishToSlug(name),
                  }));
                }}
                placeholder="Kitchen Cabinets"
              />
            </label>
            <label className="block space-y-1.5">
              <AdminFieldLabel>Slug</AdminFieldLabel>
              <AdminInput
                value={newCategory.slug}
                onChange={(event) =>
                  setNewCategory((current) => ({ ...current, slug: event.target.value }))
                }
                placeholder="kitchen-cabinets"
              />
            </label>
            <AdminButton
              type="submit"
              variant="primary"
              size="md"
              disabled={isSaving}
              className="w-full"
            >
              Add category
            </AdminButton>
          </form>
        </AdminPanel>

        <AdminPanel>
          <h2 className="text-lg font-semibold text-navy dark:text-cream">Category list</h2>
          <p className="mt-2 text-sm text-muted dark:text-cream/70">
            Categories with products cannot be deleted until those products are moved or removed.
          </p>

          {message && <AdminAlert tone="success">{message}</AdminAlert>}
          {error && <AdminAlert tone="error">{error}</AdminAlert>}

          {isLoading ? (
            <p className="mt-6 text-sm text-muted dark:text-cream/70">Loading categories...</p>
          ) : categories.length === 0 ? (
            <AdminEmptyState>
              No categories yet. Add your first category to enable product classification.
            </AdminEmptyState>
          ) : (
            <AdminListStack>
              {categories.map((category) => {
                const subForm = getSubCategoryForm(category.id);

                return (
                  <AdminListCard key={category.id}>
                    {editingCategoryId === category.id ? (
                      <form onSubmit={handleUpdateCategory} className="space-y-3">
                        <AdminInput
                          required
                          value={editCategoryForm.name}
                          onChange={(event) =>
                            setEditCategoryForm((current) => ({
                              ...current,
                              name: event.target.value,
                            }))
                          }
                        />
                        <AdminInput
                          required
                          value={editCategoryForm.slug}
                          onChange={(event) =>
                            setEditCategoryForm((current) => ({
                              ...current,
                              slug: event.target.value,
                            }))
                          }
                        />
                        <AdminActionRow>
                          <AdminButton type="submit" variant="primary" disabled={isSaving}>
                            Save
                          </AdminButton>
                          <AdminButton type="button" onClick={() => setEditingCategoryId(null)}>
                            Cancel
                          </AdminButton>
                        </AdminActionRow>
                      </form>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-navy dark:text-cream">
                              {category.name}
                            </p>
                            <p className="mt-1 text-sm text-muted dark:text-cream/70">
                              {category.slug}
                            </p>
                          </div>
                          <AdminBadge tone="neutral">
                            {category.productCount} product
                            {category.productCount === 1 ? "" : "s"}
                          </AdminBadge>
                        </div>

                        <AdminActionRow>
                          <AdminButton type="button" onClick={() => startEditCategory(category)}>
                            Edit
                          </AdminButton>
                          <AdminButton
                            type="button"
                            variant="danger"
                            disabled={category.productCount > 0}
                            onClick={() => handleDeleteCategory(category)}
                          >
                            Delete
                          </AdminButton>
                        </AdminActionRow>

                        <div className="mt-4 border-t border-border/60 pt-4 dark:border-cream/10">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted dark:text-cream/60">
                            Subcategories
                          </p>

                          {category.subCategories.length === 0 ? (
                            <p className="mt-2 text-sm text-muted dark:text-cream/70">
                              No subcategories yet.
                            </p>
                          ) : (
                            <ul className="mt-3 space-y-2">
                              {category.subCategories.map((subCategory) => (
                                <li
                                  key={subCategory.id}
                                  className="rounded-lg border border-border/50 bg-cream/30 px-3 py-2.5 dark:border-cream/10 dark:bg-navy/20"
                                >
                                  {editingSubCategoryId === subCategory.id ? (
                                    <form onSubmit={handleUpdateSubCategory} className="space-y-2">
                                      <AdminInput
                                        required
                                        value={editSubCategoryForm.name}
                                        onChange={(event) =>
                                          setEditSubCategoryForm((current) => ({
                                            ...current,
                                            name: event.target.value,
                                          }))
                                        }
                                      />
                                      <AdminInput
                                        required
                                        value={editSubCategoryForm.slug}
                                        onChange={(event) =>
                                          setEditSubCategoryForm((current) => ({
                                            ...current,
                                            slug: event.target.value,
                                          }))
                                        }
                                      />
                                      <label className="block space-y-1">
                                        <AdminFieldLabel>Parent category</AdminFieldLabel>
                                        <select
                                          required
                                          value={editSubCategoryForm.categoryId}
                                          onChange={(event) =>
                                            setEditSubCategoryForm((current) => ({
                                              ...current,
                                              categoryId: event.target.value,
                                            }))
                                          }
                                          className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-navy outline-none focus:border-brand dark:border-cream/20 dark:bg-navy dark:text-cream"
                                        >
                                          {categories.map((item) => (
                                            <option key={item.id} value={item.id}>
                                              {item.name}
                                            </option>
                                          ))}
                                        </select>
                                      </label>
                                      <AdminActionRow>
                                        <AdminButton
                                          type="submit"
                                          variant="primary"
                                          disabled={isSaving}
                                        >
                                          Save
                                        </AdminButton>
                                        <AdminButton
                                          type="button"
                                          onClick={() => setEditingSubCategoryId(null)}
                                        >
                                          Cancel
                                        </AdminButton>
                                      </AdminActionRow>
                                    </form>
                                  ) : (
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div>
                                        <p className="text-sm font-medium text-navy dark:text-cream">
                                          {subCategory.name}
                                        </p>
                                        <p className="text-xs text-muted dark:text-cream/65">
                                          {subCategory.slug}
                                        </p>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <AdminBadge tone="neutral">
                                          {subCategory.productCount} product
                                          {subCategory.productCount === 1 ? "" : "s"}
                                        </AdminBadge>
                                        <AdminButton
                                          type="button"
                                          size="sm"
                                          onClick={() =>
                                            startEditSubCategory(category.id, subCategory)
                                          }
                                        >
                                          Edit
                                        </AdminButton>
                                        <AdminButton
                                          type="button"
                                          size="sm"
                                          variant="danger"
                                          disabled={subCategory.productCount > 0}
                                          onClick={() => handleDeleteSubCategory(subCategory)}
                                        >
                                          Delete
                                        </AdminButton>
                                      </div>
                                    </div>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}

                          <form
                            onSubmit={(event) => handleCreateSubCategory(event, category.id)}
                            className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                          >
                            <AdminInput
                              required
                              value={subForm.name}
                              onChange={(event) => {
                                const name = event.target.value;
                                updateSubCategoryForm(category.id, {
                                  name,
                                  slug: subForm.slug || finishToSlug(name),
                                });
                              }}
                              placeholder="Subcategory name"
                            />
                            <AdminInput
                              value={subForm.slug}
                              onChange={(event) =>
                                updateSubCategoryForm(category.id, { slug: event.target.value })
                              }
                              placeholder="slug"
                            />
                            <AdminButton type="submit" variant="primary" disabled={isSaving}>
                              Add
                            </AdminButton>
                          </form>
                        </div>
                      </>
                    )}
                  </AdminListCard>
                );
              })}
            </AdminListStack>
          )}

          <p className="mt-6 text-sm text-muted dark:text-cream/70">
            New categories appear immediately in{" "}
            <Link href="/admin/products" className="font-medium text-brand hover:underline">
              Add product
            </Link>{" "}
            and the public catalog.
          </p>
        </AdminPanel>
      </div>
    </AdminShell>
  );
}
