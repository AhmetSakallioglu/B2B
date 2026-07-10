"use client";

import { useCallback, useRef, useState } from "react";
import { AdminButton, AdminPanel } from "@/components/admin/admin-ui";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Toast } from "@/components/ui/Toast";
import { BULK_UPLOAD_TEMPLATE_HEADERS } from "@/lib/product-bulk-upload.constants";
import {
  parseBulkUploadPreview,
  type BulkUploadPreviewResult,
} from "@/lib/product-bulk-upload-preview";

type BulkUploadResponse = {
  success?: boolean;
  message?: string;
  error?: string;
  createdProducts?: number;
  updatedProducts?: number;
  createdVariants?: number;
  updatedVariants?: number;
  skippedRows?: number;
  errors?: Array<{ row: number; message: string }>;
};

type BulkProductUploadProps = {
  onComplete?: () => void;
};

const ACCEPTED_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  ".xlsx",
  ".xls",
  ".csv",
];

const PREVIEW_COLUMNS = [
  { key: "category", label: "Category" },
  { key: "subCategory", label: "SubCategory" },
  { key: "productSku", label: "Product SKU" },
  { key: "productName", label: "Product Name" },
  { key: "color", label: "Color" },
  { key: "price", label: "Price" },
  { key: "stock", label: "Stock" },
] as const;

export function BulkProductUpload({ onComplete }: BulkProductUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<BulkUploadPreviewResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Array<{ row: number; message: string }>>([]);
  const [toast, setToast] = useState<{ message: string; description?: string } | null>(null);

  const resetSelection = useCallback(() => {
    setSelectedFile(null);
    setPreview(null);
    setError(null);
    setRowErrors([]);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, []);

  const uploadFile = useCallback(
    async (file: File) => {
      setIsUploading(true);
      setError(null);
      setRowErrors([]);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/admin/products/bulk-upload", {
          method: "POST",
          body: formData,
        });

        const data = (await response.json()) as BulkUploadResponse;

        if (!response.ok) {
          setRowErrors(data.errors ?? []);
          throw new Error(data.error ?? "Bulk upload failed");
        }

        const processedCount = (data.createdVariants ?? 0) + (data.updatedVariants ?? 0);
        const skipped = data.skippedRows ?? 0;

        setToast({
          message: `${processedCount} product${processedCount === 1 ? "" : "s"} successfully imported to the database.`,
          description:
            skipped > 0
              ? `${data.createdVariants ?? 0} created, ${data.updatedVariants ?? 0} updated, ${skipped} row(s) skipped.`
              : undefined,
        });

        if (data.errors && data.errors.length > 0) {
          setRowErrors(data.errors);
        }

        resetSelection();
        onComplete?.();
      } catch (uploadError) {
        setError(
          uploadError instanceof Error ? uploadError.message : "Bulk upload failed"
        );
      } finally {
        setIsUploading(false);
      }
    },
    [onComplete, resetSelection]
  );

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0 || isParsing || isUploading) {
        return;
      }

      const file = files[0];
      setSelectedFile(file);
      setPreview(null);
      setError(null);
      setRowErrors([]);
      setIsParsing(true);

      try {
        const previewResult = await parseBulkUploadPreview(file);
        setPreview(previewResult);
      } catch (parseError) {
        setSelectedFile(null);

        if (inputRef.current) {
          inputRef.current.value = "";
        }

        setError(
          parseError instanceof Error
            ? parseError.message
            : "Failed to read the uploaded file"
        );
      } finally {
        setIsParsing(false);
      }
    },
    [isParsing, isUploading]
  );

  const downloadTemplate = async () => {
    setError(null);

    try {
      const response = await fetch("/api/admin/products/bulk-upload/template");

      if (!response.ok) {
        throw new Error("Failed to download template");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "cabinet-bulk-upload-template.xlsx";
      link.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Failed to download template"
      );
    }
  };

  const hasPreview = Boolean(selectedFile && preview);
  const dropZoneDisabled = isParsing || isUploading;

  return (
    <>
      <AdminPanel className="sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <h2 className="text-lg font-semibold text-navy dark:text-cream">
              Bulk Import (Excel / CSV)
            </h2>
            <p className="mt-2 text-sm text-muted dark:text-cream/70">
              Upload hundreds of cabinet modules and finish variants in one step.
              Existing variants with the same product, dimensions, and color will
              have their price and stock updated.
            </p>
          </div>
          <AdminButton type="button" variant="secondary" onClick={downloadTemplate}>
            Download sample template
          </AdminButton>
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-cream-dark p-4 dark:border-border dark:bg-navy/60">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Required columns
          </p>
          <p className="mt-2 text-sm text-navy/90 dark:text-cream/90">
            {BULK_UPLOAD_TEMPLATE_HEADERS.join(" · ")}
          </p>
        </div>

        <div
          onDragEnter={(event) => {
            event.preventDefault();
            if (!dropZoneDisabled) {
              setIsDragging(true);
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (!dropZoneDisabled) {
              setIsDragging(true);
            }
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);

            if (!dropZoneDisabled) {
              void handleFiles(event.dataTransfer.files);
            }
          }}
          className={`mt-6 flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-10 text-center transition ${
            isDragging
              ? "border-brand bg-brand-light/40 dark:bg-brand/10"
              : "border-border bg-surface hover:border-brand/60 hover:bg-cream-dark/60 dark:border-border dark:bg-navy dark:hover:bg-navy-hover/60"
          } ${dropZoneDisabled ? "pointer-events-none opacity-70" : ""}`}
          onClick={() => {
            if (!dropZoneDisabled) {
              inputRef.current?.click();
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();

              if (!dropZoneDisabled) {
                inputRef.current?.click();
              }
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Upload Excel or CSV file"
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            className="hidden"
            disabled={dropZoneDisabled}
            onChange={(event) => {
              void handleFiles(event.target.files);
            }}
          />

          {isParsing ? (
            <>
              <LoadingSpinner size="lg" />
              <p className="mt-4 text-sm font-medium text-navy dark:text-cream">
                Reading {selectedFile?.name ?? "file"}...
              </p>
              <p className="mt-1 text-sm text-muted dark:text-cream/70">
                Preparing preview before upload.
              </p>
            </>
          ) : hasPreview ? (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-light text-brand dark:bg-brand/15">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  className="h-7 w-7"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                  />
                </svg>
              </div>
              <p className="mt-4 text-base font-semibold text-navy dark:text-cream">
                {selectedFile?.name}
              </p>
              <p className="mt-2 text-sm text-muted dark:text-cream/70">
                Review the preview below, then confirm to import.
              </p>
            </>
          ) : (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-light text-brand dark:bg-brand/15">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  className="h-7 w-7"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 16V4m0 0 8-4m-4 4 4-4M4 16.5v2A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5v-2"
                  />
                </svg>
              </div>
              <p className="mt-4 text-base font-semibold text-navy dark:text-cream">
                Drag & drop your Excel or CSV file here
              </p>
              <p className="mt-2 text-sm text-muted dark:text-cream/70">
                or click to browse · .xlsx, .xls, .csv · up to 5000 rows
              </p>
            </>
          )}
        </div>

        {hasPreview && preview && (
          <div className="mt-6 rounded-3xl border border-border bg-white p-5 shadow-sm dark:border-border dark:bg-navy-hover">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  File preview
                </p>
                <p className="mt-1 text-base font-semibold text-navy dark:text-cream">
                  {selectedFile?.name} · {preview.rowCount} row
                  {preview.rowCount === 1 ? "" : "s"} found
                </p>
                <p className="mt-1 text-sm text-muted dark:text-cream/70">
                  Showing the first {Math.min(preview.sampleRows.length, 5)} rows. Nothing is
                  imported until you confirm.
                </p>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto rounded-2xl border border-border dark:border-border">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-cream-dark/70 text-xs uppercase tracking-wide text-muted dark:border-border dark:bg-navy/70 dark:text-cream/65">
                    {PREVIEW_COLUMNS.map((column) => (
                      <th key={column.key} className="px-3 py-3 font-semibold whitespace-nowrap">
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.sampleRows.map((row, index) => (
                    <tr
                      key={`preview-row-${index}`}
                      className="border-b border-border last:border-0 dark:border-border"
                    >
                      {PREVIEW_COLUMNS.map((column) => (
                        <td
                          key={column.key}
                          className="px-3 py-3 text-navy/90 dark:text-cream/90 whitespace-nowrap"
                        >
                          {row[column.key] || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
              <AdminButton
                type="button"
                variant="ghost"
                size="md"
                disabled={isUploading}
                onClick={resetSelection}
              >
                Cancel
              </AdminButton>
              <AdminButton
                type="button"
                variant="primary"
                size="md"
                disabled={isUploading || !selectedFile}
                onClick={() => {
                  if (selectedFile) {
                    void uploadFile(selectedFile);
                  }
                }}
              >
                {isUploading ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Uploading...
                  </>
                ) : (
                  "Confirm & Upload"
                )}
              </AdminButton>
            </div>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </p>
        )}

        {rowErrors.length > 0 && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Row warnings ({rowErrors.length})
            </p>
            <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-sm text-amber-900/90 dark:text-amber-100/90">
              {rowErrors.slice(0, 20).map((item) => (
                <li key={`${item.row}-${item.message}`}>
                  Row {item.row}: {item.message}
                </li>
              ))}
            </ul>
            {rowErrors.length > 20 && (
              <p className="mt-2 text-xs text-amber-800 dark:text-amber-200/80">
                Showing first 20 row issues.
              </p>
            )}
          </div>
        )}
      </AdminPanel>

      {toast && (
        <Toast
          message={toast.message}
          description={toast.description}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
