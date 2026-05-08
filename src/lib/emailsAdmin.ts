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

/** Collection telle que dans la console Firebase. */
export const EMAILS_COLLECTION = "Emails";

export type AdminEmailRow = {
  id: string;
  email: string;
  statut: string;
  statutFieldName: string;
  dateAjout: Date | null;
  /** Indique si le champ Firestore est booléen (pour updateDoc). */
  statutIsBoolean: boolean;
};

export const STATUT_VERIFIE = "Vérifié";
export const STATUT_NON_VERIFIE = "Non vérifié";

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

function detectStatutField(data: Record<string, unknown>): string {
  for (const k of [
    "statut",
    "status",
    "verifie",
    "verified",
    "estVerifie",
  ] as const) {
    if (k in data) return k;
  }
  return "statut";
}

function coerceStatutDisplay(
  field: string,
  data: Record<string, unknown>
): { label: string; isBoolean: boolean } {
  const raw = data[field];
  if (typeof raw === "boolean") {
    return {
      label: raw ? STATUT_VERIFIE : STATUT_NON_VERIFIE,
      isBoolean: true,
    };
  }
  const s = str(raw);
  if (!s) return { label: STATUT_NON_VERIFIE, isBoolean: false };
  const lower = s.toLowerCase();
  if (
    lower === "true" ||
    lower === "1" ||
    (lower.includes("verif") && !lower.includes("non")) ||
    lower === "ok"
  )
    return { label: STATUT_VERIFIE, isBoolean: false };
  if (
    lower === "false" ||
    lower === "0" ||
    lower.includes("non verif") ||
    lower.includes("non véri")
  )
    return { label: STATUT_NON_VERIFIE, isBoolean: false };
  return { label: s, isBoolean: false };
}

export function normalizeEmailDoc(
  id: string,
  data: Record<string, unknown>
): AdminEmailRow {
  const statutFieldName = detectStatutField(data);
  const { label, isBoolean } = coerceStatutDisplay(statutFieldName, data);
  const email =
    str(pickFirst(data, ["email", "mail", "adresse", "courriel"])) || "—";
  const dateAjout = toDate(
    pickFirst(data, [
      "dateAjout",
      "createdAt",
      "date",
      "timestamp",
      "addedAt",
    ])
  );

  return {
    id,
    email,
    statut: label,
    statutFieldName,
    dateAjout,
    statutIsBoolean: isBoolean,
  };
}

export async function loadAdminEmailRows(db: Firestore): Promise<AdminEmailRow[]> {
  const snap = await getDocs(collection(db, EMAILS_COLLECTION));
  const rows: AdminEmailRow[] = [];
  snap.forEach((d) => {
    rows.push(normalizeEmailDoc(d.id, d.data() as Record<string, unknown>));
  });
  rows.sort((a, b) => {
    const ta = a.dateAjout?.getTime() ?? 0;
    const tb = b.dateAjout?.getTime() ?? 0;
    return tb - ta;
  });
  return rows;
}

export async function markEmailVerified(
  db: Firestore,
  row: Pick<AdminEmailRow, "id" | "statutFieldName" | "statutIsBoolean">
): Promise<void> {
  const ref = doc(db, EMAILS_COLLECTION, row.id);
  if (row.statutIsBoolean) {
    await updateDoc(ref, {
      [row.statutFieldName]: true,
      updatedAt: serverTimestamp(),
    });
    return;
  }
  await updateDoc(ref, {
    [row.statutFieldName]: STATUT_VERIFIE,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteAdminEmailDoc(db: Firestore, id: string): Promise<void> {
  await deleteDoc(doc(db, EMAILS_COLLECTION, id));
}
