import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  Timestamp,
  type Firestore,
} from "firebase/firestore";

/** Collection où enregistrer les nouveaux messages (formulaire site / admin lecture). */
export const CONTACT_MESSAGE_WRITE_COLLECTION = "messages";

/** Collections souvent utilisées côte à côte dans l’ancienne app. */
export const CONTACT_MESSAGE_COLLECTIONS = ["messages", "messages2"] as const;

export type AdminContactMessageRow = {
  id: string;
  /** Collection d’origine (pour deleteDoc). */
  sourceCollection: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  message: string;
  date: Date | null;
  /** Texte Firestore non converti en Date (ex. date déjà formatée à la main). */
  dateRaw: string | null;
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

/** Libellé court pour tableau / recherche / CSV. */
export function displayMessageDate(
  row: Pick<AdminContactMessageRow, "date" | "dateRaw">
): string {
  if (row.date) {
    return row.date.toLocaleString("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  }
  if (row.dateRaw) return row.dateRaw;
  return "—";
}

/** Libellé long pour la modale. */
export function displayMessageDateLong(
  row: Pick<AdminContactMessageRow, "date" | "dateRaw">
): string {
  if (row.date) {
    return row.date.toLocaleString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (row.dateRaw) return row.dateRaw;
  return "—";
}

export function normalizeContactMessageDoc(
  id: string,
  sourceCollection: string,
  data: Record<string, unknown>
): AdminContactMessageRow {
  const nom = str(pickFirst(data, ["nom", "lastname", "lastName", "name"]));
  const prenom = str(pickFirst(data, ["prenom", "firstname", "firstName"]));
  const email = str(pickFirst(data, ["email", "mail", "courriel"])) || "—";
  const telephone = str(
    pickFirst(data, ["telephone", "tel", "phone", "mobile", "portable"])
  );
  const message = str(
    pickFirst(data, [
      "message",
      "contenu",
      "texte",
      "body",
      "commentaire",
      "msg",
    ])
  );

  const tsKeys = [
    "createdAt",
    "updatedAt",
    "date",
    "timestamp",
    "horodatage",
    "dateCreation",
    "dateMessage",
    "dateEnvoi",
    "sentAt",
    "time",
    "heureMessage",
  ] as const;

  let date = toDate(pickFirst(data, [...tsKeys]));

  const stringDateKeys = [
    "dateStr",
    "dateMessageStr",
    "heure",
    "dateHeure",
    "created",
  ] as const;

  let dateRaw: string | null = null;
  if (!date) {
    for (const k of stringDateKeys) {
      const v = data[k];
      if (typeof v !== "string" || !v.trim()) continue;
      const trimmed = v.trim();
      const parsed = toDate(trimmed);
      if (parsed) {
        date = parsed;
        break;
      }
      if (!dateRaw) dateRaw = trimmed;
    }
  }

  return {
    id,
    sourceCollection,
    nom: nom || "—",
    prenom: prenom || "—",
    email,
    telephone: telephone || "—",
    message: message || "—",
    date,
    dateRaw,
  };
}

export async function loadContactMessageRows(
  db: Firestore
): Promise<AdminContactMessageRow[]> {
  const rows: AdminContactMessageRow[] = [];
  for (const colName of CONTACT_MESSAGE_COLLECTIONS) {
    try {
      const snap = await getDocs(collection(db, colName));
      snap.forEach((d) => {
        rows.push(
          normalizeContactMessageDoc(
            d.id,
            colName,
            d.data() as Record<string, unknown>
          )
        );
      });
    } catch {
      /* collection absente ou règles */
    }
  }
  rows.sort((a, b) => {
    const ta = a.date?.getTime() ?? 0;
    const tb = b.date?.getTime() ?? 0;
    if (tb !== ta) return tb - ta;
    const sa = a.dateRaw ?? "";
    const sb = b.dateRaw ?? "";
    return sb.localeCompare(sa, "fr");
  });
  return rows;
}

export async function deleteContactMessage(
  db: Firestore,
  sourceCollection: string,
  docId: string
): Promise<void> {
  await deleteDoc(doc(db, sourceCollection, docId));
}
