import type { Timestamp } from "firebase/firestore";

function str(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return String(v);
}

function toDate(raw: unknown): Date | null {
  if (raw == null) return null;
  if (
    typeof raw === "object" &&
    raw !== null &&
    "toDate" in raw &&
    typeof (raw as Timestamp).toDate === "function"
  ) {
    try {
      return (raw as Timestamp).toDate();
    } catch {
      return null;
    }
  }
  if (typeof raw === "string" || typeof raw === "number") {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export type ClientTransactionRow = {
  id: string;
  date: Date | null;
  type: string;
  titre: string;
  montantDisplay: string;
};

export function formatClientTxAmount(raw: unknown): string {
  if (typeof raw === "number" && Number.isFinite(raw)) return `${raw} €`;
  if (typeof raw === "string" && raw.trim()) {
    const t = raw.trim();
    return t.includes("€") ? t : `${t} €`;
  }
  return "—";
}

export function labelClientTxType(raw: unknown): string {
  const t = str(raw).toLowerCase();
  if (!t) return "Paiement";
  if (t.includes("renouvel")) return "Renouvellement";
  if (t.includes("abonn")) return "Abonnement";
  if (t.includes("paiement")) return "Paiement";
  return str(raw) || "Paiement";
}

export function mapFirestoreTxToClientRow(
  id: string,
  data: Record<string, unknown>
): ClientTransactionRow {
  return {
    id,
    date: toDate(data.transactionDate ?? data.date ?? data.createdAt),
    type: labelClientTxType(data.type),
    titre: str(data.titre) || str(data.role) || "Paiement",
    montantDisplay: formatClientTxAmount(
      data.montant ?? data.amount ?? data.prix
    ),
  };
}
