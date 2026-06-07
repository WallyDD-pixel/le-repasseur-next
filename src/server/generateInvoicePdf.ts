import fs from "node:fs";
import path from "node:path";

import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFPage } from "pdf-lib";

import type { CompanyInvoiceInfo } from "@/lib/companyInvoiceConfig";

const NAVY = rgb(16 / 255, 41 / 255, 75 / 255);
const RED = rgb(206 / 255, 32 / 255, 41 / 255);
const SLATE = rgb(0.35, 0.38, 0.42);
const LIGHT = rgb(0.956, 0.965, 0.973);
const WHITE = rgb(1, 1, 1);

const LOGO_RELATIVE_PATH = path.join(
  "public",
  "assets",
  "imgg",
  "LOGO-LeRepasseur-Fond-Fonce.png"
);

export type SiteInvoiceLine = {
  label: string;
  amountEuros: number;
};

export type SiteInvoiceData = {
  invoiceNumber: string;
  invoiceDate: Date;
  typeLabel: string;
  company: CompanyInvoiceInfo;
  clientName: string;
  clientEmail: string;
  clientAddressLines: string[];
  lines: SiteInvoiceLine[];
  totalEuros: number;
  paymentNote: string;
  stripeReference?: string;
};

function formatEuros(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function formatDateFr(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const next = current ? `${current} ${w}` : w;
    if (next.length > maxChars) {
      if (current) lines.push(current);
      current = w;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [text];
}

function drawLine(
  page: PDFPage,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color = SLATE,
  thickness = 0.5
) {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, color, thickness });
}

async function embedBrandLogo(pdf: PDFDocument): Promise<PDFImage | null> {
  const logoPath = path.join(process.cwd(), LOGO_RELATIVE_PATH);
  try {
    const bytes = fs.readFileSync(logoPath);
    return await pdf.embedPng(bytes);
  } catch {
    console.warn("[generateInvoicePdf] Logo introuvable :", logoPath);
    return null;
  }
}

function drawHeader(
  page: PDFPage,
  data: SiteInvoiceData,
  margin: number,
  width: number,
  yTop: number,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  fontBold: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  logo: PDFImage | null
): number {
  const contentWidth = width - margin * 2;
  const headerHeight = 72;

  page.drawRectangle({
    x: margin,
    y: yTop - headerHeight,
    width: contentWidth,
    height: headerHeight,
    color: NAVY,
  });
  page.drawRectangle({
    x: margin,
    y: yTop - headerHeight,
    width: contentWidth,
    height: 3,
    color: RED,
  });

  const headerCenterY = yTop - headerHeight / 2 - 4;

  if (logo) {
    const logoH = 52;
    const logoW = (logo.width / logo.height) * logoH;
    page.drawImage(logo, {
      x: margin + 14,
      y: headerCenterY - logoH / 2,
      width: logoW,
      height: logoH,
    });
  } else {
    page.drawText(data.company.tradeName, {
      x: margin + 16,
      y: headerCenterY - 4,
      size: 20,
      font: fontBold,
      color: WHITE,
    });
  }

  const factureBlockX = width - margin - 128;
  page.drawText("FACTURE", {
    x: factureBlockX,
    y: headerCenterY + 10,
    size: 20,
    font: fontBold,
    color: WHITE,
  });
  page.drawText(data.invoiceNumber, {
    x: factureBlockX,
    y: headerCenterY - 8,
    size: 10,
    font,
    color: rgb(0.88, 0.91, 0.95),
  });
  page.drawText(data.company.website, {
    x: factureBlockX,
    y: headerCenterY - 22,
    size: 8,
    font,
    color: rgb(0.75, 0.8, 0.88),
  });

  return yTop - headerHeight - 20;
}

export async function generateSiteInvoicePdf(
  data: SiteInvoiceData
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const margin = 48;
  const contentWidth = width - margin * 2;

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await embedBrandLogo(pdf);

  let y = height - margin;
  y = drawHeader(page, data, margin, width, y, font, fontBold, logo);

  const emitterStartY = y;
  page.drawText("Émetteur", { x: margin, y, size: 9, font: fontBold, color: RED });
  y -= 14;
  const emitter = [
    data.company.legalName,
    data.company.tradeName !== data.company.legalName
      ? data.company.tradeName
      : "",
    data.company.addressLine1,
    data.company.addressLine2,
    data.company.siret ? `SIRET : ${data.company.siret}` : "",
    data.company.email,
    data.company.phone,
  ].filter(Boolean);
  for (const line of emitter) {
    page.drawText(line, { x: margin, y, size: 9, font, color: SLATE });
    y -= 12;
  }

  let clientY = emitterStartY;
  const clientX = width / 2 + 12;
  page.drawRectangle({
    x: clientX - 12,
    y: clientY - 108,
    width: width - margin - clientX + 12,
    height: 108,
    color: LIGHT,
    borderColor: rgb(0.88, 0.9, 0.93),
    borderWidth: 1,
  });
  page.drawText("Client", {
    x: clientX,
    y: clientY,
    size: 9,
    font: fontBold,
    color: RED,
  });
  clientY -= 14;
  page.drawText(data.clientName, {
    x: clientX,
    y: clientY,
    size: 10,
    font: fontBold,
    color: NAVY,
  });
  clientY -= 14;
  if (data.clientEmail) {
    page.drawText(data.clientEmail, {
      x: clientX,
      y: clientY,
      size: 9,
      font,
      color: SLATE,
    });
    clientY -= 12;
  }
  for (const line of data.clientAddressLines) {
    page.drawText(line, { x: clientX, y: clientY, size: 9, font, color: SLATE });
    clientY -= 12;
  }

  y = Math.min(y, clientY - 16) - 8;

  page.drawRectangle({
    x: margin,
    y: y - 20,
    width: contentWidth,
    height: 20,
    color: rgb(0.99, 0.99, 1),
    borderColor: rgb(0.9, 0.92, 0.95),
    borderWidth: 1,
  });
  page.drawText(`Date : ${formatDateFr(data.invoiceDate)}`, {
    x: margin + 10,
    y: y - 14,
    size: 9,
    font,
    color: SLATE,
  });
  page.drawText(`Nature : ${data.typeLabel}`, {
    x: margin + 220,
    y: y - 14,
    size: 9,
    font,
    color: SLATE,
  });
  y -= 36;

  const tableTop = y;
  page.drawRectangle({
    x: margin,
    y: tableTop - 24,
    width: contentWidth,
    height: 24,
    color: NAVY,
  });
  page.drawText("Désignation", {
    x: margin + 12,
    y: tableTop - 16,
    size: 9,
    font: fontBold,
    color: WHITE,
  });
  page.drawText("Montant net", {
    x: width - margin - 82,
    y: tableTop - 16,
    size: 9,
    font: fontBold,
    color: WHITE,
  });

  y = tableTop - 38;
  for (const line of data.lines) {
    const wrapped = wrapText(line.label, 62);
    const rowHeight = Math.max(wrapped.length * 12, 14) + 10;
    page.drawRectangle({
      x: margin,
      y: y - rowHeight + 6,
      width: contentWidth,
      height: rowHeight,
      color: WHITE,
      borderColor: rgb(0.92, 0.94, 0.96),
      borderWidth: 1,
    });
    for (let i = 0; i < wrapped.length; i++) {
      page.drawText(wrapped[i]!, {
        x: margin + 12,
        y: y - i * 12,
        size: 9,
        font,
        color: SLATE,
      });
    }
    page.drawText(formatEuros(line.amountEuros), {
      x: width - margin - 82,
      y,
      size: 9,
      font: fontBold,
      color: NAVY,
    });
    y -= rowHeight + 4;
  }

  y -= 4;
  page.drawRectangle({
    x: width - margin - 190,
    y: y - 30,
    width: 190,
    height: 30,
    color: rgb(0.99, 0.97, 0.97),
    borderColor: RED,
    borderWidth: 1.5,
  });
  page.drawText("Total net", {
    x: width - margin - 176,
    y: y - 19,
    size: 9,
    font: fontBold,
    color: NAVY,
  });
  page.drawText(formatEuros(data.totalEuros), {
    x: width - margin - 82,
    y: y - 19,
    size: 12,
    font: fontBold,
    color: RED,
  });

  y -= 52;
  page.drawText("Paiement", {
    x: margin,
    y,
    size: 9,
    font: fontBold,
    color: NAVY,
  });
  y -= 14;
  page.drawText(data.paymentNote, {
    x: margin,
    y,
    size: 9,
    font,
    color: SLATE,
    maxWidth: contentWidth,
    lineHeight: 11,
  });
  if (data.stripeReference) {
    y -= 24;
    page.drawText(`Réf. Stripe : ${data.stripeReference}`, {
      x: margin,
      y,
      size: 8,
      font,
      color: SLATE,
    });
  }

  y -= 28;
  page.drawText(data.company.vatMention, {
    x: margin,
    y,
    size: 8,
    font,
    color: SLATE,
    maxWidth: contentWidth,
    lineHeight: 10,
  });

  if (data.company.iban) {
    y -= 24;
    page.drawText(`IBAN : ${data.company.iban}`, {
      x: margin,
      y,
      size: 8,
      font,
      color: SLATE,
    });
  }

  const footerY = margin + 12;
  drawLine(page, margin, footerY + 14, margin + contentWidth, footerY + 14, RED, 1);
  page.drawText(
    `${data.company.tradeName} — ${data.company.addressLine1}, ${data.company.addressLine2} — ${data.company.email}`,
    {
      x: margin,
      y: footerY,
      size: 7,
      font,
      color: SLATE,
    }
  );

  return pdf.save();
}
