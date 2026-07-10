import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export type StorageCategory =
  | "products"
  | "company-logos"
  | "announcements"
  | "tax-documents"
  | "client-quotes";

const CATEGORY_CONFIG: Record<
  StorageCategory,
  { localDir: string; publicPrefix: string }
> = {
  products: {
    localDir: path.join("public", "uploads", "products"),
    publicPrefix: "/uploads/products/",
  },
  "company-logos": {
    localDir: path.join("public", "uploads", "company-logos"),
    publicPrefix: "/uploads/company-logos/",
  },
  announcements: {
    localDir: path.join("public", "uploads", "announcements"),
    publicPrefix: "/uploads/announcements/",
  },
  "tax-documents": {
    localDir: path.join("storage", "tax-documents"),
    publicPrefix: "/storage/tax-documents/",
  },
  "client-quotes": {
    localDir: path.join("storage", "client-quotes"),
    publicPrefix: "/storage/client-quotes/",
  },
};

function contentTypeForExtension(extension: string) {
  switch (extension.toLowerCase()) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "pdf":
      return "application/pdf";
    case "doc":
      return "application/msword";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    default:
      return "application/octet-stream";
  }
}

export function isBlobStorageEnabled() {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN?.trim() || process.env.BLOB_STORE_ID?.trim()
  );
}

function isVercelRuntime() {
  return process.env.VERCEL === "1";
}

function requireWritableObjectStorage() {
  if (isBlobStorageEnabled() || !isVercelRuntime()) {
    return;
  }

  throw new Error(
    "File uploads are not configured for production. In Vercel: Storage → your Blob store → Connect to Project (Production + Preview), then redeploy."
  );
}

export function isRemoteStorageUrl(value: string | null | undefined): boolean {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

export function isVercelBlobUrl(value: string) {
  return value.includes(".blob.vercel-storage.com");
}

export function resolveLocalStoredPath(storedUrl: string | null | undefined) {
  if (!storedUrl || isRemoteStorageUrl(storedUrl)) {
    return null;
  }

  const normalized = storedUrl.replace(/\\/g, "/");

  for (const config of Object.values(CATEGORY_CONFIG)) {
    if (!normalized.startsWith(config.publicPrefix)) {
      continue;
    }

    const filename = path.basename(normalized);

    if (!filename || filename.includes("..")) {
      return null;
    }

    return path.join(process.cwd(), config.localDir, filename);
  }

  return null;
}

export async function saveStoredFile(params: {
  category: StorageCategory;
  buffer: Buffer;
  extension: string;
  contentType?: string;
}) {
  requireWritableObjectStorage();

  const filename = `${randomUUID()}.${params.extension}`;
  const contentType = params.contentType ?? contentTypeForExtension(params.extension);

  if (isBlobStorageEnabled()) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`${params.category}/${filename}`, params.buffer, {
      access: "public",
      contentType,
      addRandomSuffix: false,
    });

    return blob.url;
  }

  const config = CATEGORY_CONFIG[params.category];
  const absoluteDir = path.join(process.cwd(), config.localDir);

  await mkdir(absoluteDir, { recursive: true });
  await writeFile(path.join(absoluteDir, filename), params.buffer);

  return `${config.publicPrefix}${filename}`;
}

export async function readStoredFile(storedUrl: string | null | undefined) {
  if (!storedUrl) {
    return null;
  }

  if (isRemoteStorageUrl(storedUrl)) {
    try {
      const response = await fetch(storedUrl, { cache: "no-store" });

      if (!response.ok) {
        return null;
      }

      return Buffer.from(await response.arrayBuffer());
    } catch {
      return null;
    }
  }

  const localPath = resolveLocalStoredPath(storedUrl);

  if (!localPath) {
    return null;
  }

  try {
    return await readFile(localPath);
  } catch {
    return null;
  }
}

export async function deleteStoredFile(storedUrl: string | null | undefined) {
  if (!storedUrl) {
    return;
  }

  if (isRemoteStorageUrl(storedUrl)) {
    if (!isVercelBlobUrl(storedUrl) || !isBlobStorageEnabled()) {
      return;
    }

    const { del } = await import("@vercel/blob");

    try {
      await del(storedUrl);
    } catch {
      // Ignore missing remote objects.
    }

    return;
  }

  const localPath = resolveLocalStoredPath(storedUrl);

  if (!localPath) {
    return;
  }

  try {
    await unlink(localPath);
  } catch {
    // Ignore missing files.
  }
}

export function storedUrlUsesPrefix(
  storedUrl: string | null | undefined,
  category: StorageCategory
) {
  if (!storedUrl) {
    return false;
  }

  if (isRemoteStorageUrl(storedUrl)) {
    return storedUrl.includes(`/${category}/`);
  }

  return storedUrl.startsWith(CATEGORY_CONFIG[category].publicPrefix);
}
