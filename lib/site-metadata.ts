import type { Metadata } from "next";
import { query } from "@/lib/db";

export const SITE_METADATA = {
  defaultTitle: "Cabinetto Pro | Wholesale Kitchen Cabinets Austin",
  titleTemplate: "%s | Cabinetto Pro",
  defaultDescription:
    "Premium wholesale kitchen cabinets and design portal for contractors and builders in Austin, Texas.",
  siteName: "Cabinetto Pro",
} as const;

export const ADMIN_SITE_METADATA = {
  defaultTitle: "Cabinetto Control Panel",
  titleTemplate: "%s | Cabinetto Admin",
  defaultDescription: "Cabinetto Pro internal administration and operations workspace.",
} as const;

export const ROOT_METADATA: Metadata = {
  title: {
    template: SITE_METADATA.titleTemplate,
    default: SITE_METADATA.defaultTitle,
  },
  description: SITE_METADATA.defaultDescription,
  applicationName: SITE_METADATA.siteName,
  openGraph: {
    type: "website",
    siteName: SITE_METADATA.siteName,
    locale: "en_US",
    title: SITE_METADATA.defaultTitle,
    description: SITE_METADATA.defaultDescription,
  },
  twitter: {
    card: "summary",
    title: SITE_METADATA.defaultTitle,
    description: SITE_METADATA.defaultDescription,
  },
};

export const ADMIN_ROOT_METADATA: Metadata = {
  title: {
    template: ADMIN_SITE_METADATA.titleTemplate,
    default: ADMIN_SITE_METADATA.defaultTitle,
  },
  description: ADMIN_SITE_METADATA.defaultDescription,
  applicationName: SITE_METADATA.siteName,
  robots: {
    index: false,
    follow: false,
  },
};

const ADMIN_ROBOTS: Metadata["robots"] = {
  index: false,
  follow: false,
};

type PageMetadataOptions = {
  description?: string;
  robots?: Metadata["robots"];
};

export function pageMetadata(title: string, options?: PageMetadataOptions): Metadata {
  const description = options?.description ?? SITE_METADATA.defaultDescription;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
    },
    twitter: {
      title,
      description,
    },
    ...(options?.robots ? { robots: options.robots } : {}),
  };
}

/** Child admin routes — title string only; template comes from app/admin/layout.tsx */
export function adminSectionMetadata(title: string, description?: string): Metadata {
  return {
    title,
    description: description ?? `${title} — ${ADMIN_SITE_METADATA.defaultDescription}`,
    robots: ADMIN_ROBOTS,
  };
}

/** @deprecated Use adminSectionMetadata for child routes; ADMIN_ROOT_METADATA on admin layout */
export function adminPageMetadata(title: string, description?: string): Metadata {
  return adminSectionMetadata(title, description);
}

export type CatalogVariantMetadata = {
  name: string;
  code: string;
};

export async function getCatalogVariantMetadata(
  variantId: string
): Promise<CatalogVariantMetadata | null> {
  const id = Number.parseInt(variantId, 10);

  if (!Number.isFinite(id) || id <= 0) {
    return null;
  }

  try {
    const result = await query<{ product_name: string; product_sku: string }>(
      `
        SELECT cp.product_name, cp.product_sku
        FROM catalog_products cp
        JOIN product_variants pv ON pv.id = cp.variant_id
        JOIN products p ON p.id = pv.product_id
        JOIN door_finishes df ON df.id = cp.finish_id
        WHERE cp.variant_id = $1
          AND pv.deleted_at IS NULL
          AND p.deleted_at IS NULL
          AND p.is_listed = true
          AND df.deleted_at IS NULL
          AND df.is_active = true
        LIMIT 1
      `,
      [id]
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return {
      name: row.product_name,
      code: row.product_sku,
    };
  } catch {
    return null;
  }
}

export function formatCatalogVariantTitle(metadata: CatalogVariantMetadata) {
  return `${metadata.name} (${metadata.code})`;
}

export async function getOrderPageTitle(orderId: string): Promise<string | null> {
  const id = Number.parseInt(orderId, 10);

  if (!Number.isFinite(id) || id <= 0) {
    return null;
  }

  try {
    const result = await query<{ id: number }>(
      `
        SELECT id
        FROM orders
        WHERE id = $1
        LIMIT 1
      `,
      [id]
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return `Order #${row.id}`;
  } catch {
    return null;
  }
}
