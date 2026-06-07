import { PDFDocument, StandardFonts, rgb, type PDFPage } from "pdf-lib";

import type { CompanyInvoiceInfo } from "@/lib/companyInvoiceConfig";

const NAVY = rgb(16 / 255, 41 / 255, 75 / 255);
const RED = rgb(206 / 255, 32 / 255, 41 / 255);
const SLATE = rgb(0.35, 0.38, 0.42);
const LIGHT = rgb(0.94, 0.95, 0.96);

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

  let y = height - margin;

  page.drawRectangle({
    x: margin,
    y: y - 56,
    width: contentWidth,
    height: 56,
    color: NAVY,
  });
  page.drawText(data.company.tradeName, {
    x: margin + 16,
    y: y - 36,
    size: 22,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText(data.company.website, {
    x: margin + 16,
    y: y - 52,
    size: 9,
    font,
    color: rgb(0.85, 0.88, 0.92),
  });
  page.drawText("FACTURE", {
    x: width - margin - 110,
    y: y - 30,
    size: 18,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText(data.invoiceNumber, {
    x: width - margin - 110,
    y: y - 48,
    size: 10,
    font,
    color: rgb(0.9, 0.92, 0.95),
  });

  y -= 80;

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
    data.company.tvaIntra ? `TVA : ${data.company.tvaIntra}` : "",
    data.company.email,
    data.company.phone,
  ].filter(Boolean);
  for (const line of emitter) {
    page.drawText(line, { x: margin, y, size: 9, font, color: SLATE });
    y -= 12;
  }

  let clientY = height - margin - 80;
  const clientX = width / 2 + 12;
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

  y = Math.min(y, clientY) - 24;

  page.drawText(`Date : ${formatDateFr(data.invoiceDate)}`, {
    x: margin,
    y,
    size: 9,
    font,
    color: SLATE,
  });
  page.drawText(`Type : ${data.typeLabel}`, {
    x: margin + 200,
    y,
    size: 9,
    font,
    color: SLATE,
  });
  y -= 28;

  const tableTop = y;
  page.drawRectangle({
    x: margin,
    y: tableTop - 22,
    width: contentWidth,
    height: 22,
    color: LIGHT,
  });
  page.drawText("Désignation", {
    x: margin + 10,
    y: tableTop - 15,
    size: 9,
    font: fontBold,
    color: NAVY,
  });
  page.drawText("Montant TTC", {
    x: width - margin - 78,
    y: tableTop - 15,
    size: 9,
    font: fontBold,
    color: NAVY,
  });
  drawLine(page, margin, tableTop - 22, margin + contentWidth, tableTop - 22);

  y = tableTop - 36;
  for (const line of data.lines) {
    const wrapped = wrapText(line.label, 62);
    for (let i = 0; i < wrapped.length; i++) {
      page.drawText(wrapped[i]!, {
        x: margin + 10,
        y: y - i * 12,
        size: 9,
        font,
        color: SLATE,
      });
    }
    page.drawText(formatEuros(line.amountEuros), {
      x: width - margin - 78,
      y,
      size: 9,
      font: fontBold,
      color: NAVY,
    });
    y -= Math.max(wrapped.length * 12, 14) + 8;
    drawLine(page, margin, y + 4, margin + contentWidth, y + 4, LIGHT, 1);
  }

  y -= 8;
  page.drawRectangle({
    x: width - margin - 170,
    y: y - 26,
    width: 170,
    height: 26,
    color: rgb(0.98, 0.96, 0.96),
    borderColor: RED,
    borderWidth: 1,
  });
  page.drawText("Total TTC", {
    x: width - margin - 158,
    y: y - 17,
    size: 10,
    font: fontBold,
    color: NAVY,
  });
  page.drawText(formatEuros(data.totalEuros), {
    x: width - margin - 78,
    y: y - 17,
    size: 11,
    font: fontBold,
    color: RED,
  });

  y -= 48;
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
  });
  if (data.stripeReference) {
    y -= 12;
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
  drawLine(page, margin, footerY + 14, margin + contentWidth, footerY + 14);
  page.drawText(
    `${data.company.tradeName} — ${data.company.website} — ${data.company.email}`,
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
