import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  buildClientQuoteDisclaimer,
} from "@/lib/client-quote-pricing";
import { formatModuleCode } from "@/lib/format-module-code";
import { readStoredFile } from "@/lib/object-storage";
import { isLocalCompanyLogo } from "@/lib/save-company-logo";
import type { ClientQuoteBranding, ClientQuotePricingResult } from "@/types/client-quotes";

type ClientQuotePdfInput = {
  quoteId: number;
  clientName: string;
  clientEmail?: string | null;
  createdAt: Date;
  branding: ClientQuoteBranding;
  pricing: ClientQuotePricingResult;
  customFooterText?: string | null;
};

function formatPdfCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPdfDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
  }).format(value);
}

async function loadLogoForPdf(logoUrl: string | null | undefined) {
  if (!isLocalCompanyLogo(logoUrl)) {
    return null;
  }

  const buffer = await readStoredFile(logoUrl);

  if (!buffer) {
    return null;
  }

  const extension = logoUrl!.split(".").pop()?.split("?")[0]?.toLowerCase();

  if (extension === "png") {
    return {
      data: buffer.toString("base64"),
      format: "PNG" as const,
    };
  }

  if (extension === "jpg" || extension === "jpeg") {
    return {
      data: buffer.toString("base64"),
      format: "JPEG" as const,
    };
  }

  return null;
}

function writeDealerAddress(doc: jsPDF, branding: ClientQuoteBranding, startY: number) {
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(90);

  const lines = [
    branding.phone,
    branding.email,
    branding.addressLine1,
    branding.addressLine2,
    [branding.city, branding.state, branding.postalCode].filter(Boolean).join(", "),
  ].filter((line) => Boolean(line && String(line).trim()));

  let y = startY;

  for (const line of lines) {
    doc.text(String(line), 14, y);
    y += 4.5;
  }

  doc.setTextColor(0);
  return y;
}

export async function buildClientQuotePdfDocument(input: ClientQuotePdfInput) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const { branding, pricing } = input;
  let headerBottomY = 28;

  const logo = await loadLogoForPdf(branding.companyLogoUrl);

  if (logo) {
    try {
      doc.addImage(logo.data, logo.format, 14, 12, 42, 18);
      headerBottomY = 34;
    } catch {
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text(branding.companyName || "Your Company", 14, 22);
      headerBottomY = 28;
    }
  } else {
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text(branding.companyName || "Your Company", 14, 22);
    headerBottomY = 28;
  }

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(90);
  doc.text("Project Quote", 14, headerBottomY);
  doc.setTextColor(0);

  doc.setFontSize(10);
  doc.text(`Quote #CQ-${input.quoteId}`, pageWidth - 14, 18, { align: "right" });
  doc.text(`Date: ${formatPdfDate(input.createdAt)}`, pageWidth - 14, 24, {
    align: "right",
  });

  const dealerInfoY = writeDealerAddress(doc, branding, headerBottomY + 8);

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Prepared for", 14, dealerInfoY + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(input.clientName, 14, dealerInfoY + 15);

  if (input.clientEmail) {
    doc.text(input.clientEmail, 14, dealerInfoY + 21);
  }

  const tableStartY = dealerInfoY + (input.clientEmail ? 30 : 24);

  autoTable(doc, {
    startY: tableStartY,
    head: [["Module Code", "Qty", "Unit Price", "Line Total"]],
    body: pricing.items.map((item) => [
      formatModuleCode({
        productSku: item.productSku,
        color: item.color,
        widthIn: Number.parseFloat(item.width),
        heightIn: Number.parseFloat(item.height),
        depthIn: Number.parseFloat(item.depth),
      }),
      String(item.quantity),
      formatPdfCurrency(item.clientUnitPrice),
      formatPdfCurrency(item.lineTotal),
    ]),
    headStyles: {
      fillColor: [41, 37, 36],
      textColor: 255,
      fontStyle: "bold",
    },
    styles: {
      fontSize: 9,
      cellPadding: 4,
      overflow: "linebreak",
    },
    columnStyles: {
      0: { cellWidth: 95 },
      1: { halign: "center", cellWidth: 18 },
      2: { halign: "right", cellWidth: 32 },
      3: { halign: "right", cellWidth: 32 },
    },
  });

  const finalY = doc.lastAutoTable?.finalY ?? tableStartY;
  let totalsY = finalY + 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  doc.text(`Merchandise subtotal: ${formatPdfCurrency(pricing.clientSubtotal)}`, pageWidth - 14, totalsY, {
    align: "right",
  });
  totalsY += 6;

  if (pricing.includeShipping) {
    doc.text(
      `Shipping & Delivery: ${pricing.shippingIsFree ? "$0.00 (Free)" : formatPdfCurrency(pricing.shippingAmount)}`,
      pageWidth - 14,
      totalsY,
      { align: "right" }
    );
    totalsY += 6;
  }

  if (pricing.includeTax && pricing.taxAmount > 0) {
    doc.text(
      `Texas Sales Tax (${(pricing.taxRate * 100).toFixed(2)}%): ${formatPdfCurrency(pricing.taxAmount)}`,
      pageWidth - 14,
      totalsY,
      { align: "right" }
    );
    totalsY += 6;
  }

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`Total: ${formatPdfCurrency(pricing.totalAmount)}`, pageWidth - 14, totalsY + 4, {
    align: "right",
  });

  const disclaimer = buildClientQuoteDisclaimer(pricing);
  const footerParts = [input.customFooterText?.trim(), disclaimer].filter(Boolean);
  let footerY = pageHeight - 24;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);

  for (const part of footerParts) {
    const wrapped = doc.splitTextToSize(String(part), pageWidth - 28);

    for (const line of wrapped) {
      doc.text(line, 14, footerY);
      footerY += 4;
    }

    footerY += 2;
  }

  doc.setTextColor(0);

  return doc;
}

export async function buildClientQuotePdfBuffer(input: ClientQuotePdfInput) {
  const doc = await buildClientQuotePdfDocument(input);
  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

export function buildClientQuoteDownloadFilename(clientName: string, quoteId: number) {
  const slug = clientName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  return `client-quote-${slug || "project"}-${quoteId}.pdf`;
}
