import type { PoolClient } from "pg";
import * as XLSX from "xlsx";
import { slugFromName } from "@/lib/catalog-categories";
import { BULK_UPLOAD_TEMPLATE_HEADERS } from "@/lib/product-bulk-upload.constants";
import { buildVariantSku } from "@/lib/product-admin";
import {
  upsertOrRestoreProduct,
  upsertOrRestoreVariant,
} from "@/lib/product-sku-upsert";

export type BulkUploadRow = {
  rowNumber: number;
  category: string;
  subCategory: string;
  productSku: string;
  productName: string;
  description: string;
  widthIn: number;
  heightIn: number;
  depthIn: number;
  color: string;
  price: number;
  stockStatus: "in_stock" | "out_of_stock";
  variantSku: string;
};

export type BulkUploadRowError = {
  row: number;
  message: string;
};

export type BulkUploadResult = {
  createdProducts: number;
  updatedProducts: number;
  createdVariants: number;
  updatedVariants: number;
  skippedRows: number;
  errors: BulkUploadRowError[];
};

const HEADER_ALIASES: Record<string, keyof Omit<BulkUploadRow, "rowNumber">> = {
  category: "category",
  subcategory: "subCategory",
  productsku: "productSku",
  sku: "productSku",
  productname: "productName",
  name: "productName",
  description: "description",
  desc: "description",
  width: "widthIn",
  widthin: "widthIn",
  w: "widthIn",
  height: "heightIn",
  heightin: "heightIn",
  h: "heightIn",
  depth: "depthIn",
  depthin: "depthIn",
  d: "depthIn",
  color: "color",
  finish: "color",
  finishname: "color",
  price: "price",
  stock: "stockStatus",
  stockstatus: "stockStatus",
  variantsku: "variantSku",
};

function normalizeHeader(key: string) {
  return key.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function cellValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }

  return String(value).trim();
}

function parseDimension(value: unknown, label: string, rowNumber: number) {
  const raw = cellValue(value).replace(/"/g, "");

  if (!raw) {
    throw new Error(`Row ${rowNumber}: ${label} is required`);
  }

  const normalized = raw.replace(/,/g, ".").replace(/\s+/g, "");
  const parsed = Number.parseFloat(normalized);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Row ${rowNumber}: Invalid ${label} "${raw}"`);
  }

  return parsed;
}

function parsePrice(value: unknown, rowNumber: number) {
  const raw = cellValue(value).replace(/[$,]/g, "");

  if (!raw) {
    throw new Error(`Row ${rowNumber}: Price is required`);
  }

  const parsed = Number.parseFloat(raw);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Row ${rowNumber}: Invalid price "${cellValue(value)}"`);
  }

  return parsed;
}

export function parseStockStatus(value: unknown, rowNumber: number) {
  const raw = cellValue(value).toLowerCase();

  if (!raw) {
    return "in_stock" as const;
  }

  const normalized = raw.replace(/\s+/g, "_");

  if (
    ["in_stock", "instock", "in", "available", "yes", "true", "1"].includes(normalized) ||
    raw === "in stock"
  ) {
    return "in_stock" as const;
  }

  if (
    ["out_of_stock", "outofstock", "out", "unavailable", "no", "false", "0"].includes(
      normalized
    ) ||
    raw === "out of stock"
  ) {
    return "out_of_stock" as const;
  }

  throw new Error(`Row ${rowNumber}: Invalid stock value "${cellValue(value)}"`);
}

function buildNormalizedRow(raw: Record<string, unknown>) {
  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(raw)) {
    normalized[normalizeHeader(key)] = value;
  }

  return normalized;
}

function mapRawRow(raw: Record<string, unknown>, rowNumber: number): BulkUploadRow {
  const normalized = buildNormalizedRow(raw);
  const mapped: Record<string, string> = {};

  for (const [key, value] of Object.entries(raw)) {
    const alias = HEADER_ALIASES[normalizeHeader(key)];

    if (!alias) {
      continue;
    }

    if (alias === "widthIn" || alias === "heightIn" || alias === "depthIn" || alias === "price" || alias === "stockStatus") {
      continue;
    }

    mapped[alias] = cellValue(value);
  }

  const category = mapped.category ?? "";
  const subCategory = mapped.subCategory ?? "";
  const productSku = (mapped.productSku ?? "").toUpperCase();
  const color = mapped.color ?? "";

  if (!category) {
    throw new Error(`Row ${rowNumber}: Category is required`);
  }

  if (!subCategory) {
    throw new Error(`Row ${rowNumber}: SubCategory is required`);
  }

  if (!productSku) {
    throw new Error(`Row ${rowNumber}: Product SKU is required`);
  }

  if (!color) {
    throw new Error(`Row ${rowNumber}: Color is required`);
  }

  const widthIn = parseDimension(normalized.width ?? normalized.w, "Width", rowNumber);
  const heightIn = parseDimension(normalized.height ?? normalized.h, "Height", rowNumber);
  const depthIn = parseDimension(normalized.depth ?? normalized.d, "Depth", rowNumber);
  const price = parsePrice(normalized.price, rowNumber);
  const stockStatus = parseStockStatus(
    normalized.stock ?? normalized.stockstatus,
    rowNumber
  );

  const productName = mapped.productName || productSku;
  const description = mapped.description || `${widthIn}"W x ${heightIn}"H x ${depthIn}"D`;
  const variantSku =
    mapped.variantSku ||
    buildVariantSku(productSku, color, widthIn, heightIn, depthIn).toUpperCase();

  return {
    rowNumber,
    category,
    subCategory,
    productSku,
    productName,
    description,
    widthIn,
    heightIn,
    depthIn,
    color,
    price,
    stockStatus,
    variantSku: variantSku.toUpperCase(),
  };
}

export function parseBulkUploadFile(buffer: Buffer, filename: string) {
  const isCsv = filename.toLowerCase().endsWith(".csv");
  const workbook = isCsv
    ? XLSX.read(buffer.toString("utf8"), { type: "string", raw: false })
    : XLSX.read(buffer, { type: "buffer", raw: false });

  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error("The uploaded file does not contain any worksheets");
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  if (rawRows.length === 0) {
    throw new Error("The uploaded file does not contain any data rows");
  }

  if (rawRows.length > 5000) {
    throw new Error("Bulk upload is limited to 5000 rows per file");
  }

  const rows: BulkUploadRow[] = [];
  const errors: BulkUploadRowError[] = [];

  rawRows.forEach((raw, index) => {
    const rowNumber = index + 2;
    const isEmpty = Object.values(raw).every((value) => cellValue(value) === "");

    if (isEmpty) {
      return;
    }

    try {
      rows.push(mapRawRow(raw, rowNumber));
    } catch (error) {
      errors.push({
        row: rowNumber,
        message: error instanceof Error ? error.message : "Invalid row",
      });
    }
  });

  if (rows.length === 0 && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "No valid rows found in file");
  }

  if (rows.length === 0) {
    throw new Error("No product rows found in file");
  }

  return { rows, errors };
}

export function buildBulkUploadTemplateBuffer() {
  const worksheet = XLSX.utils.aoa_to_sheet([
    [...BULK_UPLOAD_TEMPLATE_HEADERS],
    [
      "Kitchen Cabinet",
      "Base Cabinet",
      "B12",
      "Base Cabinet B12",
      '12"W x 34.5"H x 24"D',
      12,
      34.5,
      24,
      "White Shaker",
      289,
      "In Stock",
      "B12-WS-12-34.5-24",
    ],
  ]);

  worksheet["!cols"] = BULK_UPLOAD_TEMPLATE_HEADERS.map(() => ({ wch: 18 }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Products");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

async function findOrCreateCategory(client: PoolClient, name: string) {
  const slug = slugFromName(name);

  const existing = await client.query<{ id: number }>(
    `
      SELECT id
      FROM categories
      WHERE slug = $1 OR lower(name) = lower($2)
      LIMIT 1
    `,
    [slug, name]
  );

  if (existing.rows[0]) {
    return { id: existing.rows[0].id, created: false };
  }

  const inserted = await client.query<{ id: number }>(
    `
      INSERT INTO categories (name, slug)
      VALUES ($1, $2)
      RETURNING id
    `,
    [name, slug]
  );

  return { id: inserted.rows[0].id, created: true };
}

async function findOrCreateSubCategory(
  client: PoolClient,
  categoryId: number,
  name: string
) {
  const slug = slugFromName(name);

  const existing = await client.query<{ id: number }>(
    `
      SELECT id
      FROM sub_categories
      WHERE category_id = $1
        AND (slug = $2 OR lower(name) = lower($3))
      LIMIT 1
    `,
    [categoryId, slug, name]
  );

  if (existing.rows[0]) {
    return { id: existing.rows[0].id, created: false };
  }

  const inserted = await client.query<{ id: number }>(
    `
      INSERT INTO sub_categories (category_id, name, slug)
      VALUES ($1, $2, $3)
      RETURNING id
    `,
    [categoryId, name, slug]
  );

  return { id: inserted.rows[0].id, created: true };
}

async function findFinishId(client: PoolClient, color: string) {
  const result = await client.query<{ id: number }>(
    `
      SELECT id
      FROM door_finishes
      WHERE deleted_at IS NULL
        AND (lower(name) = lower($1) OR slug = $2)
      LIMIT 1
    `,
    [color, slugFromName(color)]
  );

  return result.rows[0]?.id ?? null;
}

async function upsertProduct(
  client: PoolClient,
  subCategoryId: number,
  row: BulkUploadRow
) {
  const result = await upsertOrRestoreProduct(client, {
    subCategoryId,
    productSku: row.productSku,
    productName: row.productName,
    description: row.description,
  });

  return {
    productId: result.productId,
    created: result.created,
    restored: result.restored,
  };
}

async function upsertVariant(
  client: PoolClient,
  productId: number,
  finishId: number,
  row: BulkUploadRow
) {
  const result = await upsertOrRestoreVariant(client, {
    productId,
    finishId,
    widthIn: row.widthIn,
    heightIn: row.heightIn,
    depthIn: row.depthIn,
    stockStatus: row.stockStatus,
    price: row.price,
    variantSku: row.variantSku,
  });

  return {
    created: result.created,
    restored: result.restored,
  };
}

export async function processBulkUploadRows(
  client: PoolClient,
  rows: BulkUploadRow[],
  initialErrors: BulkUploadRowError[] = []
) {
  const result: BulkUploadResult = {
    createdProducts: 0,
    updatedProducts: 0,
    createdVariants: 0,
    updatedVariants: 0,
    skippedRows: 0,
    errors: [...initialErrors],
  };

  const categoryCache = new Map<string, number>();
  const subCategoryCache = new Map<string, number>();
  const finishCache = new Map<string, number>();
  const productCreatedCache = new Set<string>();

  for (const row of rows) {
    try {
      const categoryKey = row.category.toLowerCase();
      let categoryId = categoryCache.get(categoryKey);

      if (!categoryId) {
        const category = await findOrCreateCategory(client, row.category);
        categoryId = category.id;
        categoryCache.set(categoryKey, categoryId);
      }

      const subCategoryKey = `${categoryId}:${row.subCategory.toLowerCase()}`;
      let subCategoryId = subCategoryCache.get(subCategoryKey);

      if (!subCategoryId) {
        const subCategory = await findOrCreateSubCategory(client, categoryId, row.subCategory);
        subCategoryId = subCategory.id;
        subCategoryCache.set(subCategoryKey, subCategoryId);
      }

      const finishKey = row.color.toLowerCase();
      let finishId = finishCache.get(finishKey);

      if (!finishId) {
        const resolvedFinishId = await findFinishId(client, row.color);

        if (!resolvedFinishId) {
          throw new Error(
            `Unknown door finish/color "${row.color}". Add it under Admin → Finishes first.`
          );
        }

        finishId = resolvedFinishId;
        finishCache.set(finishKey, finishId);
      }

      const product = await upsertProduct(client, subCategoryId, row);

      if (!productCreatedCache.has(row.productSku)) {
        if (product.created || product.restored) {
          result.createdProducts += 1;
        } else {
          result.updatedProducts += 1;
        }
        productCreatedCache.add(row.productSku);
      }

      const variant = await upsertVariant(client, product.productId, finishId, row);

      if (variant.created || variant.restored) {
        result.createdVariants += 1;
      } else {
        result.updatedVariants += 1;
      }
    } catch (error) {
      result.skippedRows += 1;
      result.errors.push({
        row: row.rowNumber,
        message: error instanceof Error ? error.message : "Failed to import row",
      });
    }
  }

  return result;
}
