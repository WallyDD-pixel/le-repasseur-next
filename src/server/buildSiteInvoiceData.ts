import * as admin from "firebase-admin";

import { getCompanyInvoiceInfo } from "@/lib/companyInvoiceConfig";
import { labelClientTxType } from "@/lib/clientTransactions";
import type { SiteInvoiceData } from "@/server/generateInvoicePdf";

function str(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return String(v);
}

function toDate(raw: unknown): Date {
  if (raw instanceof admin.firestore.Timestamp) return raw.toDate();
  if (
    raw &&
    typeof raw === "object" &&
    "toDate" in raw &&
    typeof (raw as { toDate: () => Date }).toDate === "function"
  ) {
    try {
      return (raw as { toDate: () => Date }).toDate();
    } catch {
      return new Date();
    }
  }
  if (typeof raw === "string" || typeof raw === "number") {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

function parseAmountEuros(data: Record<string, unknown>): number {
  const raw = data.montant ?? data.amount ?? data.prix;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const n = Number.parseFloat(raw.replace(",", ".").replace(/€/g, "").trim());
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function clientNameFromUser(user: Record<string, unknown>): string {
  const prenom = str(user.prenom);
  const nom = str(user.nom);
  const duo = `${prenom} ${nom}`.trim();
  if (duo) return duo;
  return str(user.displayName) || str(user.email) || "Client";
}

function clientAddressLines(user: Record<string, unknown>): string[] {
  const lines: string[] = [];
  const numero = str(user.numero);
  const voie = str(user.voie);
  const street = `${numero} ${voie}`.trim();
  const complement = str(user.complementAdresse);
  const cp = str(user.codePostal);
  const ville = str(user.ville);
  const cityLine = `${cp} ${ville}`.trim();

  if (street) lines.push(street);
  if (complement) lines.push(complement);
  if (cityLine) lines.push(cityLine);

  const tel = str(user.telephone);
  if (tel) lines.push(`Tél. ${tel}`);

  return lines;
}

function invoiceNumberForTransaction(
  txId: string,
  tx: Record<string, unknown>
): string {
  const stored = str(tx.invoiceNumber);
  if (stored) return stored;

  const stripeInv = str(tx.stripeInvoiceId);
  if (stripeInv.startsWith("in_")) {
    return `FAC-${stripeInv.slice(-8).toUpperCase()}`;
  }

  const d = toDate(tx.transactionDate ?? tx.createdAt);
  const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  const suffix = txId.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase();
  return `FAC-${ym}-${suffix || "000001"}`;
}

export function buildSiteInvoiceData(
  txId: string,
  tx: Record<string, unknown>,
  user: Record<string, unknown>
): SiteInvoiceData {
  const company = getCompanyInvoiceInfo();
  const amount = parseAmountEuros(tx);
  const titre = str(tx.titre) || str(tx.role) || "Prestation Le Repasseur";
  const typeLabel = labelClientTxType(tx.type);
  const invoiceDate = toDate(tx.transactionDate ?? tx.date ?? tx.createdAt);

  const stripeRef =
    str(tx.stripeInvoiceId) ||
    str(tx.stripeCheckoutSessionId) ||
    undefined;

  return {
    invoiceNumber: invoiceNumberForTransaction(txId, tx),
    invoiceDate,
    typeLabel,
    company,
    clientName: clientNameFromUser(user),
    clientEmail: str(user.email),
    clientAddressLines: clientAddressLines(user),
    lines: [
      {
        label: titre,
        amountEuros: amount,
      },
    ],
    totalEuros: amount,
    paymentNote:
      "Paiement sécurisé en ligne (carte bancaire via Stripe). Facture acquittée.",
    stripeReference: stripeRef,
  };
}

export function invoicePdfFilename(data: SiteInvoiceData): string {
  const safe = data.invoiceNumber.replace(/[^a-zA-Z0-9-_]/g, "-");
  return `facture-${safe}.pdf`;
}
