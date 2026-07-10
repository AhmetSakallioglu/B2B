"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CatalogProductCardGallery } from "@/components/catalog/CatalogProductCardGallery";
import { CatalogSiteHeader } from "@/components/catalog/CatalogSiteHeader";
import { ProductCatalogImage } from "@/components/catalog/ProductCatalogImage";
import { AddToCartButton } from "@/components/cart/AddToCartButton";
import { CartItemsList, CartTotals } from "@/components/cart/CartItemsList";
import { CartUnavailableNotice } from "@/components/cart/CartUnavailableNotice";
import {
  ALL_CABINETS_TAB_KEY,
  ALL_CABINETS_TAB_LABEL,
  areCatalogFiltersEqual,
  buildParentCategoryOptions,
  buildSubCategoryTabs,
  filterProductsByCatalogFilter,
  isAllCabinetsTab,
  matchesCatalogSearch,
  resolveSearchFilterRedirect,
  type CatalogFilterState,
} from "@/lib/catalog-browse";
import { buildCartItemLabel } from "@/lib/format-dimensions";
import { useSession } from "@/components/auth/SessionProvider";
import { LoadingState } from "@/components/ui/LoadingState";
import { ArrowLeftIcon, ExternalLinkIcon, SearchIcon, ShoppingCartIcon, TrashIcon } from "@/components/ui/Icon";
import { IconLabel } from "@/components/ui/IconLabel";
import { useCartValidation } from "@/hooks/useCartValidation";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { useCartStore } from "@/store/useCartStore";
import { ui } from "@/lib/ui-classes";
import type { CatalogProduct, DoorFinish } from "@/types/catalog";

const PRODUCT_GRID_CLASS =
  "grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6";

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

type CatalogBrowserProps = {
  selectedFinish: DoorFinish;
};

export function CatalogBrowser({ selectedFinish }: CatalogBrowserProps) {
  const { user } = useSession();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeParentCategory, setActiveParentCategory] = useState(ALL_CABINETS_TAB_KEY);
  const [activeSubTabKey, setActiveSubTabKey] = useState<string | null>(null);
  const [pricesVisible, setPricesVisible] = useState(false);
  const filterBeforeSearchRef = useRef<CatalogFilterState>({
    parentCategory: ALL_CABINETS_TAB_KEY,
    subTabKey: null,
  });
  const previousSearchRef = useRef("");

  const items = useCartStore((state) => state.items);
  const totalItems = useCartStore((state) => state.totalItems());
  const lastFeedback = useCartStore((state) => state.lastFeedback);
  const clearCart = useCartStore((state) => state.clearCart);
  const hasUnavailableItems = useCartStore((state) => state.hasUnavailableItems());
  const isValidatingAvailability = useCartStore((state) => state.isValidatingAvailability);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartPanelPulse, setCartPanelPulse] = useState(false);

  const isAdmin = user?.role === "admin";
  const canUseCart = Boolean(user) && !isAdmin;

  useCartValidation(canUseCart);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await fetch(
        `/api/products?finish=${encodeURIComponent(selectedFinish.slug)}`
      );

      if (!response.ok) {
        throw new Error("Failed to load products");
      }

      const data = (await response.json()) as {
        products: CatalogProduct[];
        pricesVisible?: boolean;
      };
      setProducts(data.products);
      setPricesVisible(data.pricesVisible === true);
    } catch {
      setLoadError("Could not load catalog for this finish.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedFinish.slug]);

  useDeferredEffect(() => {
    void fetchProducts();
  }, [fetchProducts, user?.id]);

  const catalogFilter = useMemo<CatalogFilterState>(
    () => ({
      parentCategory: activeParentCategory,
      subTabKey: activeSubTabKey,
    }),
    [activeParentCategory, activeSubTabKey]
  );

  const parentCategories = useMemo(
    () => buildParentCategoryOptions(products),
    [products]
  );

  const subTabs = useMemo(
    () =>
      isAllCabinetsTab(activeParentCategory)
        ? []
        : buildSubCategoryTabs(products, activeParentCategory),
    [activeParentCategory, products]
  );

  useDeferredEffect(() => {
    if (parentCategories.length === 0) {
      setActiveParentCategory(ALL_CABINETS_TAB_KEY);
      setActiveSubTabKey(null);
      return;
    }

    if (
      !isAllCabinetsTab(activeParentCategory) &&
      !parentCategories.some((category) => category.name === activeParentCategory)
    ) {
      setActiveParentCategory(ALL_CABINETS_TAB_KEY);
      setActiveSubTabKey(null);
    }
  }, [activeParentCategory, parentCategories]);

  useDeferredEffect(() => {
    if (isAllCabinetsTab(activeParentCategory)) {
      setActiveSubTabKey(null);
      return;
    }

    if (
      activeSubTabKey &&
      !subTabs.some((tab) => tab.key === activeSubTabKey)
    ) {
      setActiveSubTabKey(null);
    }
  }, [activeParentCategory, activeSubTabKey, subTabs]);

  useEffect(() => {
    const trimmedSearch = searchQuery.trim();
    const wasSearching = previousSearchRef.current.trim().length > 0;

    if (!trimmedSearch) {
      if (wasSearching) {
        setActiveParentCategory(filterBeforeSearchRef.current.parentCategory);
        setActiveSubTabKey(filterBeforeSearchRef.current.subTabKey);
      }

      previousSearchRef.current = trimmedSearch;
      return;
    }

    if (!wasSearching) {
      filterBeforeSearchRef.current = catalogFilter;
    }

    previousSearchRef.current = trimmedSearch;

    const redirectedFilter = resolveSearchFilterRedirect(
      products,
      catalogFilter,
      trimmedSearch
    );

    if (
      redirectedFilter &&
      !areCatalogFiltersEqual(redirectedFilter, catalogFilter)
    ) {
      setActiveParentCategory(redirectedFilter.parentCategory);
      setActiveSubTabKey(redirectedFilter.subTabKey);
    }
  }, [catalogFilter, products, searchQuery]);

  const tabScopedProducts = useMemo(
    () => filterProductsByCatalogFilter(products, catalogFilter),
    [catalogFilter, products]
  );

  const filteredProducts = useMemo(
    () =>
      tabScopedProducts.filter((product) => matchesCatalogSearch(product, searchQuery)),
    [searchQuery, tabScopedProducts]
  );

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    !isAllCabinetsTab(activeParentCategory) ||
    activeSubTabKey !== null;

  const clearFilters = () => {
    setSearchQuery("");
    setActiveParentCategory(ALL_CABINETS_TAB_KEY);
    setActiveSubTabKey(null);
    filterBeforeSearchRef.current = {
      parentCategory: ALL_CABINETS_TAB_KEY,
      subTabKey: null,
    };
  };

  const selectParentCategory = (parentCategory: string) => {
    setActiveParentCategory(parentCategory);
    setActiveSubTabKey(null);

    if (!searchQuery.trim()) {
      filterBeforeSearchRef.current = {
        parentCategory,
        subTabKey: null,
      };
    }
  };

  const selectSubCategory = (subTabKey: string) => {
    setActiveSubTabKey(subTabKey);

    if (!searchQuery.trim()) {
      filterBeforeSearchRef.current = {
        parentCategory: activeParentCategory,
        subTabKey,
      };
    }
  };

  useDeferredEffect(() => {
    if (!lastFeedback || lastFeedback.type !== "add" || isAdmin) {
      return;
    }

    setCartPanelPulse(true);
    const timer = setTimeout(() => setCartPanelPulse(false), 700);
    return () => clearTimeout(timer);
  }, [lastFeedback?.at, isAdmin]);

  useEffect(() => {
    if (!cartOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCartOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [cartOpen]);

  return (
    <div className={ui.catalogPageBg}>
      <CatalogSiteHeader subtitle={`${selectedFinish.name} · Catalog`} />

      <main className="mx-auto max-w-[1600px] space-y-5 px-4 py-6 xl:px-8">
        <section className={`overflow-hidden ${ui.catalogCard}`}>
          <div className="border-b border-slate-200/80 bg-linear-to-br from-brand-light/20 via-white to-slate-50/80 px-4 py-4 sm:px-5 dark:border-zinc-700/50 dark:from-brand-light/10 dark:via-navy dark:to-navy-hover/40">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-200/60 bg-white p-1 shadow-sm dark:border-zinc-700/50 dark:bg-navy sm:h-16 sm:w-16">
                <ProductCatalogImage
                  src={selectedFinish.sampleImage}
                  alt={selectedFinish.name}
                  sizes="64px"
                  className="h-full w-full rounded-lg object-cover"
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className={ui.eyebrow}>Selected finish</p>
                <h1 className="truncate text-lg font-bold tracking-tight text-slate-950 dark:text-cream sm:text-xl">
                  {selectedFinish.name}
                </h1>
                <p className={`mt-0.5 hidden text-xs sm:block ${ui.bodyMuted}`}>
                  {isLoading
                    ? "Loading cabinets..."
                    : `${products.length} cabinet${products.length === 1 ? "" : "s"} in this finish`}
                </p>
              </div>

              <Link
                href="/"
                className={`shrink-0 ${ui.btnSecondary} px-3 py-2 text-xs sm:text-sm`}
              >
                <IconLabel icon={<ArrowLeftIcon size={14} />}>
                  <span className="hidden sm:inline">Change finish</span>
                  <span className="sm:hidden">Change</span>
                </IconLabel>
              </Link>
            </div>
          </div>

          {(parentCategories.length > 0 || products.length > 0) && (
            <div className="space-y-4 p-4 sm:p-5">
              <div className="relative">
                <SearchIcon
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  size={16}
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search SKU, name, or description..."
                  className={`${ui.input} py-2.5 pl-10`}
                  aria-label={`Search cabinets in ${selectedFinish.name}`}
                />
              </div>

              <div className="space-y-4 border-t border-slate-200/80 pt-4 dark:border-zinc-700/50">
                <div>
                  <p className={`mb-2.5 ${ui.fieldLabel}`}>Category</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => selectParentCategory(ALL_CABINETS_TAB_KEY)}
                      className={
                        isAllCabinetsTab(activeParentCategory)
                          ? ui.catalogPillActive
                          : ui.catalogPillIdle
                      }
                    >
                      {ALL_CABINETS_TAB_LABEL}
                      <span className="ml-2 opacity-75">{products.length}</span>
                    </button>
                    {parentCategories.map((category) => (
                      <button
                        key={category.name}
                        type="button"
                        onClick={() => selectParentCategory(category.name)}
                        className={
                          activeParentCategory === category.name
                            ? ui.catalogPillActive
                            : ui.catalogPillIdle
                        }
                      >
                        {category.name}
                        <span className="ml-2 opacity-75">{category.count}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {!isAllCabinetsTab(activeParentCategory) && subTabs.length > 0 && (
                  <div>
                    <p className={`mb-2.5 ${ui.fieldLabel}`}>Subcategory</p>
                    <div className="flex flex-wrap gap-2">
                      {subTabs.map((tab) => (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => selectSubCategory(tab.key)}
                          className={
                            activeSubTabKey === tab.key
                              ? ui.catalogSubPillActive
                              : ui.catalogSubPillIdle
                          }
                        >
                          {tab.label}
                          <span className="ml-1.5 opacity-70">{tab.count}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {!isLoading && filteredProducts.length > 0 && (
                <p className={`border-t border-slate-200/80 pt-4 text-xs dark:border-zinc-700/50 ${ui.bodyMuted}`}>
                  Showing {filteredProducts.length} cabinet
                  {filteredProducts.length === 1 ? "" : "s"}
                  {hasActiveFilters ? " matching your filters" : ""}
                </p>
              )}
            </div>
          )}
        </section>

          {isLoading ? (
            <div className="space-y-5">
              <LoadingState label="Loading cabinets..." minHeight="min-h-24" />
              <div className={`${PRODUCT_GRID_CLASS} isolate`}>
              {Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={index}
                  className="h-[300px] animate-pulse rounded-xl border border-slate-200/60 bg-white dark:border-zinc-700/50 dark:bg-navy"
                />
              ))}
              </div>
            </div>
          ) : loadError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center dark:border-red-900/50 dark:bg-red-950/30">
              <p className="text-base font-medium text-red-800 dark:text-red-300">{loadError}</p>
              <button type="button" onClick={fetchProducts} className={`mt-4 ${ui.btnPrimary}`}>
                Retry
              </button>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className={`px-6 py-16 text-center ${ui.emptyState}`}>
              <p className="text-base font-semibold text-slate-900 dark:text-cream">
                No cabinets match your search or filters
              </p>
              <p className={`mt-2 ${ui.bodyMuted}`}>Try another category or clear your search.</p>
              {hasActiveFilters && (
                <button type="button" onClick={clearFilters} className={`mt-4 ${ui.btnSecondary}`}>
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className={`${PRODUCT_GRID_CLASS} isolate`}>
              {filteredProducts.map((product) => {
                const inCart = items.find((item) => item.id === product.id);
                const isOutOfStock = product.stockStatus === "Out of Stock";
                const cartLabel = buildCartItemLabel(
                  product.productSku,
                  product.color,
                  product.width,
                  product.height,
                  product.depth
                );
                const productHref = `/catalog/product/${product.id}?finish=${encodeURIComponent(selectedFinish.slug)}`;

                return (
                  <article
                    key={product.id}
                    className={`relative flex flex-col rounded-xl ${ui.catalogProductCard}`}
                  >
                    <Link
                      href={productHref}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex flex-1 flex-col transition hover:bg-slate-50/60 dark:hover:bg-navy-hover/40"
                    >
                      <CatalogProductCardGallery
                        product={product}
                        isOutOfStock={isOutOfStock}
                        compact
                      />

                      <div className="relative flex flex-1 flex-col gap-2.5 border-t border-slate-100 p-3 dark:border-zinc-800/80">
                        <span
                          className="pointer-events-none absolute right-3 top-3 z-10 inline-flex items-center justify-center rounded-lg border border-slate-200/80 bg-slate-50 p-1.5 text-slate-500 shadow-sm transition group-hover:border-slate-300 group-hover:bg-slate-100 group-hover:text-slate-800 dark:border-zinc-700/50 dark:bg-navy-hover dark:text-cream/60 dark:group-hover:text-cream"
                          aria-hidden
                        >
                          <ExternalLinkIcon size={14} />
                        </span>

                        <div className="min-w-0 flex-1 pr-10">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-brand">
                            {product.subCategory}
                          </p>
                          <p className="mt-1 text-sm font-semibold leading-snug text-slate-900 transition group-hover:text-brand dark:text-cream dark:group-hover:text-brand">
                            {product.name}
                          </p>
                          {product.description && (
                            <p className={`mt-1 line-clamp-1 text-xs leading-relaxed ${ui.bodyMuted}`}>
                              {product.description}
                            </p>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-1.5">
                          {(
                            [
                              ["W", product.width],
                              ["H", product.height],
                              ["D", product.depth],
                            ] as const
                          ).map(([label, value]) => (
                            <div
                              key={label}
                              className="rounded-lg border border-slate-200/70 bg-slate-50/90 px-1.5 py-1.5 text-center dark:border-zinc-700/50 dark:bg-navy-hover/50"
                            >
                              <span className="block text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                                {label}
                              </span>
                              <span className="mt-0.5 block text-[11px] font-semibold text-slate-800 dark:text-cream/90">
                                {value}
                              </span>
                            </div>
                          ))}
                        </div>

                        {pricesVisible && typeof product.price === "number" && (
                          <p className="text-base font-bold text-slate-950 dark:text-brand">
                            {formatPrice(product.price)}
                          </p>
                        )}
                      </div>
                    </Link>

                    {pricesVisible && !isOutOfStock && (
                      <div className="border-t border-slate-100 px-3 pb-3 pt-2.5 dark:border-zinc-800/80">
                        <AddToCartButton
                          item={{
                            id: product.id,
                            name: cartLabel,
                            width: product.width,
                            height: product.height,
                            depth: product.depth,
                            price: product.price!,
                          }}
                          inCart={Boolean(inCart)}
                          isAdmin={isAdmin}
                          isOutOfStock={isOutOfStock}
                          fullWidth
                          className="!py-2 !text-xs"
                        />
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
      </main>

      {!isAdmin && canUseCart && !cartOpen && (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className={`fixed bottom-4 right-4 z-30 flex items-center gap-2 ${ui.btnSecondary} px-4 py-3 shadow-lg xl:bottom-auto xl:right-6 xl:top-24 ${
            cartPanelPulse ? "animate-cart-panel-pulse" : ""
          }`}
          aria-label="Open cart"
        >
          <ShoppingCartIcon size={20} className="text-brand" />
          <span className="text-sm font-semibold text-slate-900 dark:text-cream">Cart</span>
          {totalItems > 0 && (
            <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold text-white">
              {totalItems}
            </span>
          )}
        </button>
      )}

      {!isAdmin && canUseCart && cartOpen && (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            aria-label="Close cart"
            className="absolute inset-0 bg-navy/40 backdrop-blur-[2px]"
            onClick={() => setCartOpen(false)}
          />

          <aside
            className={`absolute right-0 top-0 flex h-full w-full max-w-[380px] flex-col border-l border-slate-200/80 bg-white shadow-2xl dark:border-zinc-700/50 dark:bg-navy ${
              cartPanelPulse ? "animate-cart-panel-pulse" : ""
            }`}
            role="dialog"
            aria-modal="true"
            aria-label="Your cart"
          >
            <div className="border-b border-slate-200/80 px-5 py-4 dark:border-zinc-700/50">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className={`flex items-center gap-2 ${ui.heading3}`}>
                    <ShoppingCartIcon size={20} className="text-brand" />
                    Your Cart
                    {totalItems > 0 && (
                      <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-white">
                        {totalItems}
                      </span>
                    )}
                  </h2>
                  <p className={`mt-1 ${ui.bodyMuted}`}>Finish: {selectedFinish.name}</p>
                  <p className={`mt-1 text-xs ${ui.bodyMuted}`}>
                    Cart stays saved for 30 days unless you change it.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCartOpen(false)}
                  className={`rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 dark:border-zinc-600 dark:text-cream/70 dark:hover:bg-navy-hover dark:hover:text-cream`}
                  aria-label="Close cart"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
              <CartItemsList compact />
            </div>

            <div className={`space-y-4 p-5 ${ui.adminActionBar}`}>
              <CartUnavailableNotice compact />
              <CartTotals mode="cart" />
              <Link
                href="/cart"
                className={`flex w-full items-center justify-center gap-2 text-center text-sm font-semibold transition ${
                  items.length === 0 || hasUnavailableItems || isValidatingAvailability
                    ? `pointer-events-none opacity-50 ${ui.btnSecondary}`
                    : ui.btnPrimary
                }`}
                aria-disabled={items.length === 0 || hasUnavailableItems || isValidatingAvailability}
                onClick={(event) => {
                  if (items.length === 0 || hasUnavailableItems || isValidatingAvailability) {
                    event.preventDefault();
                  }
                }}
              >
                <ShoppingCartIcon size={16} />
                Review & checkout
              </Link>
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={clearCart}
                  className={`inline-flex w-full items-center justify-center gap-2 ${ui.btnGhost} text-slate-500 dark:text-cream/70`}
                >
                  <TrashIcon size={15} />
                  Clear cart
                </button>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
