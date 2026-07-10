import { readFile } from "fs/promises";
import path from "path";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { OrderPackingListData } from "@/types/order-packing-list";

const CABINETTO_LOGO_PATH = path.join(process.cwd(), "public", "logo", "cabinetto.png");
const LOGO_MAX_HEIGHT = 14;
const LOGO_MAX_WIDTH = 48;

function formatPdfDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
  }).format(new Date(value));
}

function readPngDimensions(buffer: Buffer) {
  if (buffer.length < 24 || buffer[0] !== 0x89) {
    return null;
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function fitLogoDimensions(naturalWidth: number, naturalHeight: number) {
  const aspectRatio = naturalWidth / naturalHeight;

  let width = LOGO_MAX_WIDTH;
  let height = width / aspectRatio;

  if (height > LOGO_MAX_HEIGHT) {
    height = LOGO_MAX_HEIGHT;
    width = height * aspectRatio;
  }

  return { width, height };
}

async function loadCabinettoLogo() {
  try {
    const buffer = await readFile(CABINETTO_LOGO_PATH);
    const dimensions = readPngDimensions(buffer);

    return {
      data: buffer.toString("base64"),
      format: "PNG" as const,
      displaySize: dimensions
        ? fitLogoDimensions(dimensions.width, dimensions.height)
        : { width: LOGO_MAX_WIDTH, height: LOGO_MAX_HEIGHT },
    };
  } catch {
    return null;
  }
}

function writeSignOffBlock(doc: jsPDF, startY: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = Math.max(startY + 18, pageHeight - 48);

  if (y > pageHeight - 40) {
    doc.addPage();
    y = 30;
  }

  doc.setDrawColor(180);
  doc.setLineWidth(0.4);
  doc.line(14, y, pageWidth - 14, y);

  y += 10;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40);
  doc.text("Site receipt / sign-off", 14, y);

  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(70);
  doc.text(
    "I confirm the modules listed above were received in good order.",
    14,
    y
  );

  y += 14;
  doc.setFontSize(10);
  doc.setTextColor(0);

  const receivedLabelX = 14;
  const signatureLabelX = pageWidth / 2 + 6;
  const lineY = y + 6;

  doc.text("Received By:", receivedLabelX, y);
  doc.line(receivedLabelX + 28, lineY, signatureLabelX - 8, lineY);

  doc.text("Signature:", signatureLabelX, y);
  doc.line(signatureLabelX + 22, lineY, pageWidth - 14, lineY);

  y += 16;
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text("Date: ____________________", receivedLabelX, y);
}

export async function buildOrderPackingListPdfBuffer(data: OrderPackingListData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const logo = await loadCabinettoLogo();
  const logoHeight = logo?.displaySize.height ?? LOGO_MAX_HEIGHT;

  if (logo) {
    doc.addImage(
      logo.data,
      logo.format,
      14,
      12,
      logo.displaySize.width,
      logo.displaySize.height
    );
  } else {
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Cabinetto", 14, 22);
  }

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30);
  doc.text("Packing List", 14, 12 + logoHeight + 8);

  const metaX = pageWidth - 14;
  let metaY = 16;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`Order #${data.orderId}`, metaX, metaY, { align: "right" });
  metaY += 6;
  doc.setFont("helvetica", "normal");
  doc.text(`Date: ${formatPdfDate(data.createdAt)}`, metaX, metaY, { align: "right" });
  metaY += 8;

  if (data.shippingAddressLines.length > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(70);

    data.shippingAddressLines.forEach((line) => {
      doc.text(line, metaX, metaY, { align: "right", maxWidth: 88 });
      metaY += 4.5;
    });
  }

  doc.setTextColor(0);

  const tableStartY = Math.max(metaY + 6, 12 + logoHeight + 16);

  autoTable(doc, {
    startY: tableStartY,
    head: [["Product Name", "Color", "Description", "Sizes", "Qty"]],
    body: data.items.map((item) => [
      item.productName,
      item.color,
      item.description,
      item.sizes,
      String(item.quantity),
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
      valign: "top",
    },
    columnStyles: {
      0: { cellWidth: 38 },
      1: { cellWidth: 24 },
      2: { cellWidth: 58 },
      3: { cellWidth: 36 },
      4: { halign: "center", cellWidth: 16 },
    },
  });

  const finalY = doc.lastAutoTable?.finalY ?? tableStartY;
  writeSignOffBlock(doc, finalY);

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(140);
  doc.text(
    "Cabinetto Pro — packing list for warehouse and jobsite use only",
    14,
    doc.internal.pageSize.getHeight() - 8
  );

  return Buffer.from(doc.output("arraybuffer"));
}

export function buildOrderPackingListDownloadFilename(orderId: number) {
  return `order-${orderId}-packing-list.pdf`;
}
