import * as XLSX from "xlsx";

export type BulkUploadPreviewRow = {
  category: string;
  subCategory: string;
  productSku: string;
  productName: string;
  color: string;
  price: string;
  stock: string;
};

export type BulkUploadPreviewResult = {
  rowCount: number;
  sampleRows: BulkUploadPreviewRow[];
};

const PREVIEW_SAMPLE_SIZE = 5;
const MAX_ROWS = 5000;

const HEADER_ALIASES: Record<string, keyof BulkUploadPreviewRow> = {
  category: "category",
  subcategory: "subCategory",
  productsku: "productSku",
  sku: "productSku",
  productname: "productName",
  name: "productName",
  color: "color",
  finish: "color",
  finishname: "color",
  price: "price",
  stock: "stock",
  stockstatus: "stock",
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

function isEmptyRow(raw: Record<string, unknown>) {
  return Object.values(raw).every((value) => cellValue(value) === "");
}

function mapPreviewRow(raw: Record<string, unknown>): BulkUploadPreviewRow {
  const mapped: BulkUploadPreviewRow = {
    category: "",
    subCategory: "",
    productSku: "",
    productName: "",
    color: "",
    price: "",
    stock: "",
  };

  for (const [key, value] of Object.entries(raw)) {
    const alias = HEADER_ALIASES[normalizeHeader(key)];

    if (!alias) {
      continue;
    }

    mapped[alias] = cellValue(value);
  }

  return mapped;
}

function readWorkbookRows(buffer: ArrayBuffer, filename: string) {
  const isCsv = filename.toLowerCase().endsWith(".csv");
  const workbook = isCsv
    ? XLSX.read(new TextDecoder("utf-8").decode(buffer), {
        type: "string",
        raw: false,
      })
    : XLSX.read(buffer, { type: "array", raw: false });

  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error("The uploaded file does not contain any worksheets");
  }

  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
}

export async function parseBulkUploadPreview(file: File): Promise<BulkUploadPreviewResult> {
  const buffer = await file.arrayBuffer();
  const rawRows = readWorkbookRows(buffer, file.name).filter((row) => !isEmptyRow(row));

  if (rawRows.length === 0) {
    throw new Error("The uploaded file does not contain any data rows");
  }

  if (rawRows.length > MAX_ROWS) {
    throw new Error("Bulk upload is limited to 5000 rows per file");
  }

  return {
    rowCount: rawRows.length,
    sampleRows: rawRows.slice(0, PREVIEW_SAMPLE_SIZE).map(mapPreviewRow),
  };
}
