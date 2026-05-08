import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
  Timestamp,
  type Firestore,
} from "firebase/firestore";

/**
 * Plusieurs noms possibles selon les versions — toutes les collections lisibles
 * sont fusionnées (évite de deviner un seul identifiant).
 */
export const RESILIATION_COLLECTION_CANDIDATES = [
  "resiliations",
  "resiliation",
  "demandesResiliation",
  "demandeResiliation",
] as const;

export const RESILIATION_ETAT_CONFIRMEE = "Confirmée";
export const RESILIATION_ETAT_ANNULEE = "Annulée";

export type ResiliationAdminRow = {
  id: string;
  collectionId: string;
  date: Date | null;
  nom: string;
  prenom: string;
  email: string;
  raison: string;
  message: string;
  etat: string;
  etatFieldName: string;
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

function detectEtatField(data: Record<string, unknown>): string {
  for (const k of ["etat", "statut", "status", "state"] as const) {
    if (k in data && data[k] != null && String(data[k]).trim() !== "")
      return k;
  }
  return "etat";
}

export function normalizeResiliationDoc(
  id: string,
  collectionId: string,
  data: Record<string, unknown>
): ResiliationAdminRow {
  const etatFieldName = detectEtatField(data);
  const etatRaw = data[etatFieldName];
  const etat = str(etatRaw) || "—";

  const nom = str(pickFirst(data, ["nom", "lastname", "lastName"]));
  const prenom = str(pickFirst(data, ["prenom", "firstname", "firstName"]));
  const email = str(pickFirst(data, ["email", "mail"])) || "—";
  const raison = str(
    pickFirst(data, ["raison", "motif", "reason", "cause"])
  );
  const message = str(
    pickFirst(data, ["message", "commentaire", "details", "texte"])
  );
  const date = toDate(
    pickFirst(data, [
      "date",
      "dateDemande",
      "createdAt",
      "timestamp",
      "horodatage",
    ])
  );

  return {
    id,
    collectionId,
    date,
    nom: nom || "—",
    prenom: prenom || "—",
    email,
    raison: raison || "—",
    message: message || "—",
    etat,
    etatFieldName,
  };
}

export async function loadResiliationRows(
  db: Firestore
): Promise<ResiliationAdminRow[]> {
  const rows: ResiliationAdminRow[] = [];
  for (const name of RESILIATION_COLLECTION_CANDIDATES) {
    try {
      const snap = await getDocs(collection(db, name));
      snap.forEach((d) => {
        rows.push(
          normalizeResiliationDoc(
            d.id,
            name,
            d.data() as Record<string, unknown>
          )
        );
      });
    } catch {
      /* collection ou règles */
    }
  }
  rows.sort((a, b) => {
    const ta = a.date?.getTime() ?? 0;
    const tb = b.date?.getTime() ?? 0;
    return tb - ta;
  });
  return rows;
}

export async function setResiliationEtat(
  db: Firestore,
  row: Pick<ResiliationAdminRow, "id" | "collectionId" | "etatFieldName">,
  etat: string
): Promise<void> {
  const ref = doc(db, row.collectionId, row.id);
  await updateDoc(ref, {
    [row.etatFieldName]: etat,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteResiliationDoc(
  db: Firestore,
  row: Pick<ResiliationAdminRow, "id" | "collectionId">
): Promise<void> {
  await deleteDoc(doc(db, row.collectionId, row.id));
}
