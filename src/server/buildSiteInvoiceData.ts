import * as admin from "firebase-admin";

import {
  CLIENT_PACK_ITEMS,
  CLIENT_SUBSCRIBER_PACK_ITEMS,
  CLIENT_SUBSCRIPTION_ITEMS,
} from "@/lib/clientCatalog";
import { getCompanyInvoiceInfo } from "@/lib/companyInvoiceConfig";
import { labelClientTxType } from "@/lib/clientTransactions";
import { userAddressFromFirestore } from "@/lib/userProfileFirestore";
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

function isBuildingComplement(text: string): boolean {
  return /^(bat|appart|appt|résidence|residence|étage|etage|bât|bâtiment|lot|esc|porte|bp)/i.test(
    text.trim()
  );
}

function clientAddressLines(user: Record<string, unknown>): string[] {
  const addr = userAddressFromFirestore(user);
  const lines: string[] = [];
  const street = `${addr.numero} ${addr.voie}`.trim();
  const cityLine = `${addr.codePostal} ${addr.ville}`.trim();
  const complement = addr.complementAdresse.trim();

  if (street) lines.push(street);
  if (complement && isBuildingComplement(complement)) {
    lines.push(complement);
  }
  if (cityLine) lines.push(cityLine);

  const tel = str(user.telephone);
  if (tel) lines.push(`Tél. ${tel}`);

  return lines;
}

/** Libellé facture pour abonnements et renouvellements (sans quota kg). */
export const INVOICE_SUBSCRIPTION_SERVICE_LABEL =
  "Prestation de service d'entretien";

function planIdFromTransaction(tx: Record<string, unknown>): string {
  const role = str(tx.role);
  if (
    role &&
    role !== "aucun" &&
    role !== "admin" &&
    role !== "attente_secteur"
  ) {
    return role;
  }
  const titre = str(tx.titre);
  const match = titre.match(/^(?:Formule|Renouvellement)\s+(.+)$/i);
  if (match?.[1]) return match[1].trim();
  return titre;
}

function kgFromPlanLabel(label: string): number | null {
  const match = label.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
  if (!match?.[1]) return null;
  const n = Number.parseFloat(match[1].replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function catalogDisplayName(planId: string): string {
  const id = planId.trim();
  if (!id) return "";
  const all = [
    ...CLIENT_SUBSCRIPTION_ITEMS,
    ...CLIENT_PACK_ITEMS,
    ...CLIENT_SUBSCRIBER_PACK_ITEMS,
  ];
  const entry = all.find(
    (p) => p.recapPlanId.toLowerCase() === id.toLowerCase()
  );
  return entry?.name ?? id;
}

function isPackProductLabel(label: string): boolean {
  const id = label.trim();
  if (!id) return false;
  if (/pack|recharge/i.test(id)) return true;
  return (
    CLIENT_PACK_ITEMS.some((p) => p.recapPlanId === id) ||
    CLIENT_SUBSCRIBER_PACK_ITEMS.some((p) => p.recapPlanId === id)
  );
}

function formatPackLabel(label: string): string | null {
  const kg = kgFromPlanLabel(label);
  if (kg == null) return null;
  const value = kg.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  return `Pack ${value} kg`;
}

function subscriptionInvoiceLineLabel(tx: Record<string, unknown>): string {
  const planId = planIdFromTransaction(tx);
  const name = catalogDisplayName(planId);
  if (!name) return INVOICE_SUBSCRIPTION_SERVICE_LABEL;

  const type = str(tx.type).toLowerCase();
  const kind = type.includes("renouvel") ? "Renouvellement" : "Abonnement";
  return `${INVOICE_SUBSCRIPTION_SERVICE_LABEL} - ${kind} ${name}`;
}

function invoiceLineLabel(tx: Record<string, unknown>): string {
  const type = str(tx.type).toLowerCase();
  if (type.includes("abonn") || type.includes("renouvel")) {
    return subscriptionInvoiceLineLabel(tx);
  }

  const planId = planIdFromTransaction(tx);
  const titre = str(tx.titre);
  const packSource = isPackProductLabel(planId)
    ? planId
    : isPackProductLabel(titre)
      ? titre
      : "";

  if (packSource) {
    const packLabel = formatPackLabel(packSource);
    if (packLabel) {
      return `${INVOICE_SUBSCRIPTION_SERVICE_LABEL} - ${packLabel}`;
    }
  }

  const name = catalogDisplayName(planId) || titre;
  if (name) return `${INVOICE_SUBSCRIPTION_SERVICE_LABEL} - ${name}`;
  return "Prestation Le Repasseur";
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
  const lineLabel = invoiceLineLabel(tx);
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
        label: lineLabel,
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
