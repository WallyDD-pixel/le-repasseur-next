import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
  type Firestore,
} from "firebase/firestore";

/** Nom exact vu dans la console Firebase (sensible à la casse). */
export const PROMO_COLLECTION = "Promo";

export type PartnerPromoRow = {
  id: string;
  poidsKg: number | null;
  poidsDisplay: string;
  code: string;
  collectes: number;
};

export type PartnerPromoFormValues = {
  code: string;
  poidsKg: number;
  collectes: number;
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

function parsePoids(raw: unknown): { kg: number | null; display: string } {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return { kg: raw, display: `${raw} kg` };
  }
  if (typeof raw === "string") {
    const cleaned = raw.replace(/\s*kg\s*$/i, "").replace(",", ".").trim();
    const n = Number.parseFloat(cleaned);
    if (!Number.isNaN(n)) return { kg: n, display: raw.trim() || `${n} kg` };
    return { kg: null, display: raw.trim() || "—" };
  }
  return { kg: null, display: "—" };
}

function coerceCollectes(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0)
    return Math.floor(raw);
  if (typeof raw === "string") {
    const n = Number.parseInt(raw, 10);
    if (!Number.isNaN(n) && n >= 0) return n;
  }
  return 0;
}

export function normalizePromoDoc(
  id: string,
  data: Record<string, unknown>
): PartnerPromoRow {
  const code = str(
    pickFirst(data, ["code", "nomCode", "promoCode", "nom"])
  ).toUpperCase();
  const { kg, display } = parsePoids(
    pickFirst(data, ["poids", "kg", "poidsKg", "weight", "poids_kg"])
  );
  const collectes = coerceCollectes(
    pickFirst(data, [
      "collectes",
      "nombreCollectes",
      "nbCollectes",
      "collecte",
      "nombre_collectes",
    ])
  );
  return {
    id,
    poidsKg: kg,
    poidsDisplay: display,
    code: code || "—",
    collectes,
  };
}

export async function loadPartnerPromoRows(
  db: Firestore
): Promise<PartnerPromoRow[]> {
  const snap = await getDocs(collection(db, PROMO_COLLECTION));
  const rows: PartnerPromoRow[] = [];
  snap.forEach((d) => {
    rows.push(normalizePromoDoc(d.id, d.data() as Record<string, unknown>));
  });
  rows.sort((a, b) => a.code.localeCompare(b.code, "fr"));
  return rows;
}

export async function createPartnerPromo(
  db: Firestore,
  v: PartnerPromoFormValues
): Promise<string> {
  const ref = await addDoc(collection(db, PROMO_COLLECTION), {
    code: v.code.trim().toUpperCase(),
    poids: v.poidsKg,
    collectes: v.collectes,
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updatePartnerPromo(
  db: Firestore,
  id: string,
  v: PartnerPromoFormValues
): Promise<void> {
  await updateDoc(doc(db, PROMO_COLLECTION, id), {
    code: v.code.trim().toUpperCase(),
    poids: v.poidsKg,
    collectes: v.collectes,
    updatedAt: serverTimestamp(),
  });
}

export async function deletePartnerPromo(
  db: Firestore,
  id: string
): Promise<void> {
  await deleteDoc(doc(db, PROMO_COLLECTION, id));
}
