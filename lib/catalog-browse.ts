export const ALL_CABINETS_TAB_KEY = "__all__";
export const ALL_CABINETS_TAB_LABEL = "All";

export type CatalogFilterState = {
  parentCategory: string;
  subTabKey: string | null;
};

export function finishToSlug(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildCatalogTabKey(category: string, subCategory: string) {
  return `${category}::${subCategory}`;
}

export function buildCatalogTabLabel(category: string, subCategory: string) {
  return `${category} · ${subCategory}`;
}

export function matchesCatalogSearch(
  product: {
    name: string;
    productSku: string;
    description: string;
    category: string;
    subCategory: string;
  },
  query: string
) {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  const haystack = [
    product.name,
    product.productSku,
    product.description,
    product.category,
    product.subCategory,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalized);
}

type CatalogTabProduct = {
  category: string;
  subCategory: string;
};

export function isAllCabinetsTab(tabKey: string) {
  return tabKey === ALL_CABINETS_TAB_KEY;
}

export function areCatalogFiltersEqual(a: CatalogFilterState, b: CatalogFilterState) {
  return a.parentCategory === b.parentCategory && a.subTabKey === b.subTabKey;
}

export function buildParentCategoryOptions<T extends CatalogTabProduct>(products: T[]) {
  const counts = new Map<string, number>();

  for (const product of products) {
    counts.set(product.category, (counts.get(product.category) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, count]) => ({ name, count }));
}

export function buildSubCategoryTabs<T extends CatalogTabProduct>(
  products: T[],
  parentCategory: string
) {
  const tabMap = new Map<string, { key: string; label: string; count: number }>();

  for (const product of products) {
    if (product.category !== parentCategory) {
      continue;
    }

    const key = buildCatalogTabKey(product.category, product.subCategory);
    const existing = tabMap.get(key);

    if (existing) {
      existing.count += 1;
    } else {
      tabMap.set(key, {
        key,
        label: product.subCategory,
        count: 1,
      });
    }
  }

  return Array.from(tabMap.values()).sort((left, right) =>
    left.label.localeCompare(right.label)
  );
}

export function filterProductsByCatalogFilter<T extends CatalogTabProduct>(
  products: T[],
  filter: CatalogFilterState
) {
  if (isAllCabinetsTab(filter.parentCategory)) {
    return products;
  }

  let scoped = products.filter((product) => product.category === filter.parentCategory);

  if (filter.subTabKey) {
    scoped = scoped.filter(
      (product) =>
        buildCatalogTabKey(product.category, product.subCategory) === filter.subTabKey
    );
  }

  return scoped;
}

/** @deprecated Use filterProductsByCatalogFilter */
export function filterProductsByCatalogTab<T extends CatalogTabProduct>(
  products: T[],
  tabKey: string
) {
  if (isAllCabinetsTab(tabKey)) {
    return products;
  }

  return products.filter(
    (product) =>
      buildCatalogTabKey(product.category, product.subCategory) === tabKey
  );
}

export function resolveSearchFilterRedirect<
  T extends CatalogTabProduct & {
    name: string;
    productSku: string;
    description: string;
  },
>(products: T[], currentFilter: CatalogFilterState, searchQuery: string) {
  const trimmed = searchQuery.trim();

  if (!trimmed) {
    return null;
  }

  const currentProducts = filterProductsByCatalogFilter(products, currentFilter);

  if (
    currentProducts.some((product) => matchesCatalogSearch(product, trimmed))
  ) {
    return null;
  }

  const globalMatches = products.filter((product) =>
    matchesCatalogSearch(product, trimmed)
  );

  if (globalMatches.length === 0) {
    return null;
  }

  const matchingTabKeys = [
    ...new Set(
      globalMatches.map((product) =>
        buildCatalogTabKey(product.category, product.subCategory)
      )
    ),
  ];

  const matchingCategories = [
    ...new Set(globalMatches.map((product) => product.category)),
  ];

  if (matchingTabKeys.length === 1) {
    const [tabKey] = matchingTabKeys;
    const match = globalMatches.find(
      (product) => buildCatalogTabKey(product.category, product.subCategory) === tabKey
    );

    if (!match) {
      return null;
    }

    return {
      parentCategory: match.category,
      subTabKey: tabKey,
    };
  }

  if (matchingCategories.length === 1) {
    return {
      parentCategory: matchingCategories[0],
      subTabKey: null,
    };
  }

  return {
    parentCategory: ALL_CABINETS_TAB_KEY,
    subTabKey: null,
  };
}

/** @deprecated Use resolveSearchFilterRedirect */
export function resolveSearchTabRedirect<
  T extends CatalogTabProduct & {
    name: string;
    productSku: string;
    description: string;
  },
>(products: T[], currentTabKey: string, searchQuery: string) {
  const redirected = resolveSearchFilterRedirect(
    products,
    { parentCategory: currentTabKey, subTabKey: null },
    searchQuery
  );

  if (!redirected) {
    return null;
  }

  if (isAllCabinetsTab(redirected.parentCategory)) {
    return ALL_CABINETS_TAB_KEY;
  }

  return redirected.subTabKey ?? ALL_CABINETS_TAB_KEY;
}
