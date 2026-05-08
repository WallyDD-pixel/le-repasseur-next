import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  type Firestore,
} from "firebase/firestore";

/** Journal paiements / abonnements (même schéma que l’app Flutter / ancienne console). */
export const TRANSACTIONS_COLLECTION = "transactions";

const USERS_COLLECTION = "users";

export type ActiviteSiteRow = {
  id: string;
  date: Date | null;
  typeLabel: string;
  typeRaw: string;
  titre: string;
  client: string;
  email: string;
  montantEuros: number | null;
  montantDisplay: string;
  numeroClient: string;
  abonnementDisplay: string;
};

function str(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return String(v);
}

function pickFirst(data: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (k in data && data[k] != null) return data[k];
  }
  return undefined;
}

function toDate(raw: unknown): Date | null {
  if (raw == null) return null;
  if (raw instanceof Timestamp) return raw.toDate();
  if (
    typeof raw === "object" &&
    raw !== null &&
    "toDate" in raw &&
    typeof (raw as { toDate: () => Date }).toDate === "function"
  ) {
    try {
      return (raw as { toDate: () => Date }).toDate();
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

function coerceDate(data: Record<string, unknown>): Date | null {
  const raw = pickFirst(data, [
    "transactionDate",
    "date",
    "createdAt",
    "timestamp",
    "time",
    "dateActivite",
    "created",
    "updatedAt",
    "horodatage",
  ]);
  return toDate(raw);
}

function coerceMontant(data: Record<string, unknown>): {
  euros: number | null;
  display: string;
} {
  const raw = pickFirst(data, [
    "montant",
    "amount",
    "prix",
    "total",
    "price",
    "montantEuros",
  ]);
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return { euros: raw, display: `${raw} €` };
  }
  if (typeof raw === "string") {
    const cleaned = raw.replace(/\s/g, "").replace(",", ".").replace(/€/g, "");
    const n = Number.parseFloat(cleaned);
    if (!Number.isNaN(n))
      return {
        euros: n,
        display: raw.includes("€") ? raw.trim() : `${n} €`,
      };
    return { euros: null, display: raw.trim() || "—" };
  }
  return { euros: null, display: "—" };
}

function labelForType(raw: string): string {
  const t = raw.toLowerCase();
  if (!t) return "Autre";
  if (t.includes("renouvel")) return "Renouvellement";
  if (t.includes("produit") || t.includes("product")) return "Produit";
  if (t.includes("abonn")) return "Abonnement";
  if (t.includes("paiement") || t.includes("payment")) return "Paiement";
  if (t.includes("commande") || t.includes("order")) return "Commande";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function normalizeTypeLabel(data: Record<string, unknown>): {
  raw: string;
  label: string;
} {
  const raw = str(
    pickFirst(data, [
      "type",
      "Type",
      "typeActivite",
      "categorie",
      "category",
      "action",
      "kind",
    ])
  );
  return { raw: raw || "autre", label: labelForType(raw || "autre") };
}

function formatShortFr(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function buildAbonnementLine(tx: Record<string, unknown>): string {
  const typeStr = str(tx.type);
  const role = str(tx.role);
  const isSub = tx.isSubscription === true;
  const ps = toDate(tx.periodStart);
  const pe = toDate(tx.periodEnd);

  const parts: string[] = [];

  if (isSub) {
    parts.push("Abonnement");
    if (role) parts.push(role);
    if (ps && pe) {
      parts.push(`Début ${formatShortFr(ps)} · Fin ${formatShortFr(pe)}`);
    } else if (ps) parts.push(`Début ${formatShortFr(ps)}`);
  } else if (typeStr) {
    parts.push(typeStr);
    if (role) parts.push(role);
  } else {
    parts.push("Transaction");
  }

  const stripeSub = str(tx.stripeSubscriptionId);
  const stripeInv = str(tx.stripeInvoiceId);
  if (stripeSub && stripeSub.length > 8) {
    parts.push(`Stripe sub …${stripeSub.slice(-6)}`);
  } else if (stripeInv && stripeInv.length > 8) {
    parts.push(`Fact. …${stripeInv.slice(-6)}`);
  }

  return parts.filter(Boolean).join(" · ") || "—";
}

function formatClientDisplay(u: Record<string, unknown>): string {
  const prenom = str(u.prenom);
  const nom = str(u.nom);
  const duo = `${prenom} ${nom}`.trim();
  if (duo) return duo;
  const dn = str(u.displayName);
  if (dn) return dn;
  return str(u.name) || "";
}

function formatClientCell(
  user: Record<string, unknown> | undefined,
  txRole: string
): string {
  const base = user ? formatClientDisplay(user) : "";
  if (base) {
    if (txRole) return `${base} (${txRole})`;
    if (user && str(user.role) === "admin") return `${base} (admin)`;
    return base;
  }
  if (txRole) return `(${txRole})`;
  return "—";
}

function pickNumeroClient(u: Record<string, unknown>): string {
  let n = str(
    pickFirst(u, [
      "numeroClient",
      "numClient",
      "codeClient",
      "refClient",
      "referenceClient",
      "customerNumber",
      "nClient",
      "numero",
    ])
  );
  if (
    n === "" ||
    n.toLowerCase() === "undefined" ||
    n.toLowerCase() === "null"
  ) {
    return "—";
  }
  return n;
}

async function fetchUsersByIds(
  db: Firestore,
  ids: string[]
): Promise<Map<string, Record<string, unknown>>> {
  const unique = [...new Set(ids)].filter(Boolean);
  const map = new Map<string, Record<string, unknown>>();
  await Promise.all(
    unique.map(async (uid) => {
      try {
        const snap = await getDoc(doc(db, USERS_COLLECTION, uid));
        if (snap.exists()) {
          map.set(uid, snap.data() as Record<string, unknown>);
        }
      } catch {
        /* règles / réseau */
      }
    })
  );
  return map;
}

function normalizeTransactionRow(
  id: string,
  tx: Record<string, unknown>,
  user: Record<string, unknown> | undefined
): ActiviteSiteRow {
  const { raw: typeRaw, label: typeLabel } = normalizeTypeLabel(tx);

  const titreFromTx = str(
    pickFirst(tx, [
      "titre",
      "title",
      "nomProduit",
      "produit",
      "productName",
      "libelle",
      "productTitle",
    ])
  );
  const role = str(tx.role);
  const titre =
    titreFromTx ||
    (role ? `Formule ${role}` : "—");

  const client = formatClientCell(user, role);

  const email = user
    ? str(pickFirst(user, ["email", "mail", "userEmail"])) || "—"
    : "—";
  const numeroClient = user ? pickNumeroClient(user) : "—";
  const { euros: montantEuros, display: montantDisplay } = coerceMontant(tx);
  const abonnementDisplay = buildAbonnementLine(tx);

  return {
    id,
    date: coerceDate(tx),
    typeLabel,
    typeRaw,
    titre,
    client,
    email,
    montantEuros,
    montantDisplay,
    numeroClient,
    abonnementDisplay,
  };
}

export async function loadActiviteSiteRows(
  db: Firestore
): Promise<ActiviteSiteRow[]> {
  const col = collection(db, TRANSACTIONS_COLLECTION);
  const orderFields = [
    "transactionDate",
    "date",
    "createdAt",
    "timestamp",
  ] as const;
  let snap: Awaited<ReturnType<typeof getDocs>> | null = null;
  for (const field of orderFields) {
    try {
      snap = await getDocs(query(col, orderBy(field, "desc")));
      break;
    } catch {
      /* index Firestore manquant ou champ absent */
    }
  }
  if (!snap) {
    snap = await getDocs(col);
  }

  const docs: { id: string; data: Record<string, unknown> }[] = [];
  snap.forEach((d) => {
    docs.push({ id: d.id, data: d.data() as Record<string, unknown> });
  });

  const userIds = docs
    .map((x) => str(x.data.userId))
    .filter(Boolean);
  const users = await fetchUsersByIds(db, userIds);

  const rows: ActiviteSiteRow[] = docs.map(({ id, data }) =>
    normalizeTransactionRow(id, data, users.get(str(data.userId)))
  );

  rows.sort((a, b) => {
    const ta = a.date?.getTime() ?? 0;
    const tb = b.date?.getTime() ?? 0;
    return tb - ta;
  });

  return rows;
}
