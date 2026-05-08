import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  Timestamp,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import {
  ABONNEMENTS_COLLECTION,
  isHiddenSystemAbonnement,
} from "@/lib/abonnementsAdmin";

export const USERS_COLLECTION = "users";

export type AdminUserRow = {
  id: string;
  inscriptionDate: Date | null;
  /** Affichage « Nom Prénom » (legacy) */
  nomAffiche: string;
  role: string;
  email: string;
  telephone: string;
  codePostal: string;
  kg: number | null;
  kgDisplay: string;
  reservations: number;
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
  if (typeof raw === "string") {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof raw === "number") {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function coerceInscriptionDate(data: Record<string, unknown>): Date | null {
  const raw = pickFirst(data, [
    "dateInscription",
    "inscriptionDate",
    "createdAt",
    "registeredAt",
    "created",
    "dateCreation",
  ]);
  return toDate(raw);
}

function coerceKg(data: Record<string, unknown>): {
  value: number | null;
  display: string;
} {
  const raw = pickFirst(data, ["kg", "poidsKg", "poids", "weightKg", "weight"]);
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return { value: raw, display: String(raw) };
  }
  if (typeof raw === "string") {
    const n = Number.parseFloat(raw.replace(",", "."));
    if (!Number.isNaN(n)) return { value: n, display: raw.trim() };
  }
  return { value: null, display: "0" };
}

function coerceReservations(data: Record<string, unknown>): number {
  const raw = pickFirst(data, [
    "reservations",
    "nombreReservations",
    "nbReservations",
    "reservationCount",
    "nbReservation",
  ]);
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0)
    return Math.floor(raw);
  if (typeof raw === "string") {
    const n = Number.parseInt(raw, 10);
    if (!Number.isNaN(n) && n >= 0) return n;
  }
  return 0;
}

function formatNomAffiche(data: Record<string, unknown>): string {
  const nom = str(pickFirst(data, ["nom", "lastname", "lastName", "nomFamille"]));
  const prenom = str(
    pickFirst(data, ["prenom", "firstname", "firstName", "prenomUsuel"])
  );
  const duo = `${nom} ${prenom}`.trim();
  if (duo) return duo;
  const dn = str(data.displayName);
  if (dn) return dn;
  return str(data.email) || "—";
}

export function normalizeUserDoc(
  id: string,
  data: Record<string, unknown>
): AdminUserRow {
  const role = str(data.role) || "aucun";
  const email = str(pickFirst(data, ["email", "mail", "courriel"])) || "—";
  const telephone = str(
    pickFirst(data, ["telephone", "tel", "phone", "mobile", "portable"])
  );
  const codePostal = str(
    pickFirst(data, ["codePostal", "cp", "zip", "postalCode", "code_postal"])
  );
  const { value: kg, display: kgDisplay } = coerceKg(data);

  return {
    id,
    inscriptionDate: coerceInscriptionDate(data),
    nomAffiche: formatNomAffiche(data),
    role,
    email,
    telephone: telephone || "—",
    codePostal: codePostal || "—",
    kg,
    kgDisplay,
    reservations: coerceReservations(data),
  };
}

/** Noms de formules issues des abonnements visibles (hors fiches système). */
export async function loadSubscribedRoleNames(
  db: Firestore
): Promise<Set<string>> {
  const snap = await getDocs(collection(db, ABONNEMENTS_COLLECTION));
  const set = new Set<string>();
  snap.forEach((d) => {
    const data = d.data() as Record<string, unknown>;
    if (isHiddenSystemAbonnement(data)) return;
    const n = data.nom;
    if (typeof n === "string" && n.trim()) set.add(n.trim());
  });
  return set;
}

export function userSubscriptionTag(
  role: string,
  subscribedRoles: Set<string>
): "admin" | "non_abonne" | "abonne" {
  const r = role.trim();
  if (!r || r.toLowerCase() === "aucun") return "non_abonne";
  if (r.toLowerCase() === "admin") return "admin";
  if (subscribedRoles.has(r)) return "abonne";
  return "non_abonne";
}

export async function loadAdminUserRows(
  db: Firestore
): Promise<AdminUserRow[]> {
  /**
   * Lecture sans orderBy : avec Firestore, un query(orderBy("createdAt"))
   * **n’inclut pas** les documents qui n’ont pas ce champ — les profils
   * créés à la main ou issus d’imports sans `createdAt` disparaissaient du tableau.
   */
  const snap = await getDocs(collection(db, USERS_COLLECTION));

  const rows: AdminUserRow[] = [];
  snap.forEach((d) => {
    rows.push(normalizeUserDoc(d.id, d.data() as Record<string, unknown>));
  });

  rows.sort((a, b) => {
    const ta = a.inscriptionDate?.getTime() ?? 0;
    const tb = b.inscriptionDate?.getTime() ?? 0;
    if (tb !== ta) return tb - ta;
    return a.nomAffiche.localeCompare(b.nomAffiche, "fr");
  });

  return rows;
}

/** Profils créés à la main : aucune date exploitable pour l’inscription. */
export function userDocLacksSignupTimestamps(data: Record<string, unknown>): boolean {
  if (data.dateInscription != null || data.inscriptionDate != null) return false;
  const createdRaw = pickFirst(data, ["createdAt"]);
  return toDate(createdRaw) == null;
}

export type SyncInscriptionDatesResult = {
  /** `dateInscription` rempli à partir de `createdAt`. */
  filledFromCreatedAt: number;
  /** Ni date ni `createdAt` : pose `createdAt` + `dateInscription` à maintenant. */
  stampedManualProfiles: number;
};

/**
 * 1) Copie `createdAt` → `dateInscription` si la date explicite manque.
 * 2) Si ni date ni `createdAt` (ex. fiche créée à la main), écrit les deux à serverTimestamp().
 */
export async function syncMissingInscriptionDates(
  db: Firestore
): Promise<SyncInscriptionDatesResult> {
  const snap = await getDocs(collection(db, USERS_COLLECTION));
  let filledFromCreatedAt = 0;
  let stampedManualProfiles = 0;
  let batch = writeBatch(db);
  let n = 0;
  const BATCH = 400;

  for (const d of snap.docs) {
    const data = d.data() as Record<string, unknown>;
    if (data.dateInscription != null || data.inscriptionDate != null) continue;

    const createdRaw = pickFirst(data, ["createdAt"]);
    const dt = toDate(createdRaw);

    if (dt) {
      batch.update(doc(db, USERS_COLLECTION, d.id), {
        dateInscription: Timestamp.fromDate(dt),
        updatedAt: serverTimestamp(),
      });
      filledFromCreatedAt++;
    } else {
      batch.update(doc(db, USERS_COLLECTION, d.id), {
        createdAt: serverTimestamp(),
        dateInscription: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      stampedManualProfiles++;
    }

    n++;
    if (n >= BATCH) {
      await batch.commit();
      batch = writeBatch(db);
      n = 0;
    }
  }
  if (n > 0) await batch.commit();

  return { filledFromCreatedAt, stampedManualProfiles };
}
