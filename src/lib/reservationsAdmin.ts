import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  Timestamp,
  where,
  type Firestore,
} from "firebase/firestore";

/**
 * Collection utilisée par l’app Flutter / ancienne console (nom avec espaces).
 */
export const RESERVATIONS_COLLECTION = "demande de reservation";

const USERS_COLLECTION = "users";

/** État initial d’une nouvelle demande. */
export const RESERVATION_ETAT_DEFAULT = "En attente";

/** Valeur écrite lors du clic « Prendre en charge » (passage depuis « En attente »). */
export const TAKE_CHARGE_ETAT = "Validation de votre demande";

/**
 * Étapes du suivi client (ordre chronologique).
 * Aligné sur l’app mobile / la gestion admin.
 */
export const RESERVATION_ETAT_OPTIONS = [
  "En attente",
  "Validation de votre demande",
  "Votre livreur est en route",
  "Linge récupéré",
  "En cours de repassage",
  "Prise en charge par votre livreur",
  "Linge restitué",
] as const;

/** Libellés historiques → index d’étape (pour affichage rétrocompatible). */
const LEGACY_ETAT_TO_INDEX: Record<string, number> = {
  "pris en charge": 1,
};

export type ReservationEtatOption = (typeof RESERVATION_ETAT_OPTIONS)[number];

export type ReservationAdminRow = {
  id: string;
  userId: string | null;
  heureReservation: Date | null;
  nom: string;
  prenom: string;
  dateReservation: Date | null;
  dateRetour: Date | null;
  /** Texte Firestore tel quel (ex. `2026-03-16 (lundi) 16:00`). */
  dateReservationDisplay: string | null;
  dateRetourDisplay: string | null;
  kg: number | null;
  kgDisplay: string;
  role: string;
  telephone: string;
  etat: string;
  etatFieldName: string;
  numeroCommande: string;
  activite: string;
  codePostal: string;
  adresseCollecte: string;
  adresseRetour: string;
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

/** `heureReservation` est souvent une chaîne ISO avec fractions > 3 chiffres. */
function parseHeureReservationField(raw: unknown): Date | null {
  if (raw == null) return null;
  if (raw instanceof Timestamp) return raw.toDate();
  const s = str(raw);
  if (!s) return null;
  const m = s.match(
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(\.\d+)?(.*)$/
  );
  if (m) {
    let frac = m[2] ?? "";
    if (frac.length > 4) frac = frac.slice(0, 4);
    const candidate = m[1] + frac + (m[3] ?? "");
    const d = new Date(candidate);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return toDate(raw);
}

/**
 * Parse la chaîne affichée type `2026-03-16 (lundi) 16:00`
 * (stockée telle quelle dans Firestore).
 */
function parseLegacyDateHeureDisplay(trimmed: string): Date | null {
  const re =
    /^(\d{4})-(\d{2})-(\d{2})\s*\([^)]*\)\s*(\d{1,2}):(\d{2})/;
  const m = trimmed.match(re);
  if (!m) return null;
  const dt = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5])
  );
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function coerceDateHeureSlot(raw: unknown): {
  date: Date | null;
  display: string | null;
} {
  if (raw == null) return { date: null, display: null };
  if (raw instanceof Timestamp) {
    const d = raw.toDate();
    return { date: d, display: null };
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return { date: null, display: null };
    const legacy = parseLegacyDateHeureDisplay(trimmed);
    if (legacy) return { date: legacy, display: trimmed };
    const d = new Date(trimmed);
    if (!Number.isNaN(d.getTime())) return { date: d, display: trimmed };
    return { date: null, display: trimmed };
  }
  const d = toDate(raw);
  return { date: d, display: null };
}

function coerceKg(data: Record<string, unknown>): {
  value: number | null;
  display: string;
} {
  const raw = pickFirst(data, ["kg", "poids", "weight", "poidsKg"]);
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return { value: raw, display: String(raw) };
  }
  if (typeof raw === "string") {
    const n = Number.parseFloat(raw.replace(",", "."));
    if (!Number.isNaN(n)) return { value: n, display: raw.trim() };
    return { value: null, display: raw.trim() || "—" };
  }
  return { value: null, display: "—" };
}

function detectEtatField(data: Record<string, unknown>): string {
  const keys = [
    "etat",
    "statut",
    "status",
    "state",
    "etatReservation",
  ] as const;
  for (const k of keys) {
    if (k in data && data[k] != null && String(data[k]).trim() !== "")
      return k;
  }
  return "etat";
}

function coerceEtat(data: Record<string, unknown>, field: string): string {
  const raw = data[field];
  const s = str(raw);
  return s || RESERVATION_ETAT_DEFAULT;
}

export function normalizeReservationEtatKey(etat: string): string {
  return etat
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** Index de l’étape courante (0–6), ou -1 si libellé inconnu. */
export function getReservationEtapeIndex(etat: string): number {
  const key = normalizeReservationEtatKey(etat);
  if (!key || key === "—") return 0;
  const legacy = LEGACY_ETAT_TO_INDEX[key];
  if (legacy != null) return legacy;
  const idx = RESERVATION_ETAT_OPTIONS.findIndex(
    (opt) => normalizeReservationEtatKey(opt) === key
  );
  return idx >= 0 ? idx : -1;
}

/** Indique si le libellé correspond à « Linge restitué » (filtre admin). */
export function isLingeRestitueLabel(etat: string): boolean {
  const t = etat
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  return t.includes("restitu");
}

function normalizeFromUser(user: Record<string, unknown> | undefined): {
  nom: string;
  prenom: string;
  role: string;
  telephone: string;
} {
  if (!user) {
    return { nom: "", prenom: "", role: "", telephone: "" };
  }
  const nom = str(pickFirst(user, ["nom", "lastname", "lastName"]));
  const prenom = str(pickFirst(user, ["prenom", "firstname", "firstName"]));
  const role = str(user.role);
  const telephone = str(
    pickFirst(user, ["telephone", "tel", "phone", "mobile"])
  );
  return { nom, prenom, role, telephone };
}

function mergeDateSlots(
  data: Record<string, unknown>,
  legacyKeys: string[],
  fallbackKeys: string[]
): { date: Date | null; display: string | null } {
  const rawLegacy = pickFirst(data, legacyKeys);
  if (rawLegacy != null && rawLegacy !== "") {
    const slot = coerceDateHeureSlot(rawLegacy);
    if (slot.display || slot.date) return slot;
  }
  const rawFb = pickFirst(data, fallbackKeys);
  if (rawFb != null && rawFb !== "") {
    return coerceDateHeureSlot(rawFb);
  }
  return { date: null, display: null };
}

export function normalizeReservationDoc(
  id: string,
  data: Record<string, unknown>,
  userData?: Record<string, unknown>
): ReservationAdminRow {
  const etatFieldName = detectEtatField(data);
  const etat = coerceEtat(data, etatFieldName);

  const uidRaw = pickFirst(data, ["userId", "uid", "idUtilisateur", "user"]);
  const userId =
    typeof uidRaw === "string" && uidRaw.trim() ? uidRaw.trim() : null;

  const fromUser = normalizeFromUser(userData);

  const nomRes = str(pickFirst(data, ["nom", "lastname", "lastName"]));
  const prenomRes = str(pickFirst(data, ["prenom", "firstname", "firstName"]));
  const nom = nomRes || fromUser.nom || "—";
  const prenom = prenomRes || fromUser.prenom || "—";

  const roleRaw = str(data.role);
  const role = roleRaw || fromUser.role || "—";

  const telRes = str(
    pickFirst(data, ["telephone", "tel", "phone", "mobile", "portable"])
  );
  const telephone = telRes || fromUser.telephone || "—";

  const heureReservation = parseHeureReservationField(
    pickFirst(data, [
      "heureReservation",
      "createdAt",
      "dateCreation",
      "timestamp",
      "horodatage",
      "dateDemande",
    ])
  );

  const slotRes = mergeDateSlots(
    data,
    ["dateHeureReservation"],
    [
      "dateReservation",
      "dateEnlevement",
      "dateCollecte",
      "dateRdv",
      "dateDepot",
      "startAt",
      "dateDebut",
      "collecte",
    ]
  );

  const slotRet = mergeDateSlots(
    data,
    ["dateHeureRetour"],
    [
      "dateRetour",
      "dateLivraison",
      "retourPrevu",
      "endAt",
      "dateFin",
      "livraison",
    ]
  );

  const { value: kg, display: kgDisplay } = coerceKg(data);

  const numeroCommande = str(
    pickFirst(data, ["numeroCommande", "numero_commande", "commande", "orderId"])
  );
  const activite = str(data.activite);
  const codePostal = str(
    pickFirst(data, ["codePostal", "cp", "code_postal"])
  );
  const adresseCollecte = str(
    pickFirst(data, ["adressecollecte", "adresseCollecte", "adresse_collecte"])
  );
  const adresseRetour = str(
    pickFirst(data, ["adresseretour", "adresseRetour", "adresse_retour"])
  );

  return {
    id,
    userId,
    heureReservation,
    nom,
    prenom,
    dateReservation: slotRes.date,
    dateRetour: slotRet.date,
    dateReservationDisplay: slotRes.display,
    dateRetourDisplay: slotRet.display,
    kg,
    kgDisplay,
    role,
    telephone,
    etat,
    etatFieldName,
    numeroCommande: numeroCommande || "—",
    activite: activite || "—",
    codePostal: codePostal || "—",
    adresseCollecte: adresseCollecte || "—",
    adresseRetour: adresseRetour || "—",
  };
}

/** Formate la date de demande. */
export function formatHeureReservation(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Affiche la chaîne Firestore si présente (ex. `2026-03-16 (lundi) 16:00`). */
export function formatReservationCreneau(
  d: Date | null,
  firestoreDisplay?: string | null
): string {
  if (firestoreDisplay?.trim()) return firestoreDisplay.trim();
  if (!d) return "—";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const weekday = d.toLocaleDateString("fr-FR", { weekday: "long" });
  const hm = d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${y}-${m}-${day} (${weekday}) ${hm}`;
}

export function reservationEtatBadgeClass(etat: string): string {
  const t = normalizeReservationEtatKey(etat);
  if (t.includes("restitu"))
    return "bg-emerald-100 text-emerald-900 ring-emerald-200";
  if (
    t.includes("repassage") ||
    t.includes("recupere") ||
    t.includes("route") ||
    t.includes("livreur") ||
    t.includes("validation") ||
    t.includes("pris en charge") ||
    t.includes("cours") ||
    t.includes("traitement")
  )
    return "bg-sky-100 text-sky-900 ring-sky-200";
  if (t.includes("attente") || t.includes("nouveau"))
    return "bg-amber-50 text-amber-900 ring-amber-200";
  return "bg-slate-100 text-slate-800 ring-slate-200";
}

const USER_ID_QUERY_FIELDS = ["userId", "uid", "idUtilisateur"] as const;

/**
 * Demandes de réservation d’un utilisateur (app mobile / legacy).
 * Interroge plusieurs champs d’identifiant pour couvrir les anciens documents.
 */
export async function loadUserReservationRows(
  db: Firestore,
  uid: string
): Promise<ReservationAdminRow[]> {
  const col = collection(db, RESERVATIONS_COLLECTION);
  const byId = new Map<string, Record<string, unknown>>();

  await Promise.all(
    USER_ID_QUERY_FIELDS.map(async (field) => {
      try {
        const snap = await getDocs(query(col, where(field, "==", uid)));
        snap.forEach((d) => {
          byId.set(d.id, d.data() as Record<string, unknown>);
        });
      } catch {
        /* index ou règles Firestore */
      }
    })
  );

  let userData: Record<string, unknown> | undefined;
  try {
    const userSnap = await getDoc(doc(db, USERS_COLLECTION, uid));
    if (userSnap.exists()) {
      userData = userSnap.data() as Record<string, unknown>;
    }
  } catch {
    /* ignore */
  }

  const rows = [...byId.entries()].map(([id, data]) =>
    normalizeReservationDoc(id, data, userData)
  );

  rows.sort((a, b) => {
    const ta = a.heureReservation?.getTime() ?? 0;
    const tb = b.heureReservation?.getTime() ?? 0;
    return tb - ta;
  });

  return rows;
}

export async function loadReservationRows(
  db: Firestore
): Promise<ReservationAdminRow[]> {
  const col = collection(db, RESERVATIONS_COLLECTION);
  const orderFields = [
    "heureReservation",
    "createdAt",
    "dateCreation",
    "timestamp",
    "dateDemande",
  ] as const;
  let snap: Awaited<ReturnType<typeof getDocs>> | null = null;
  for (const field of orderFields) {
    try {
      snap = await getDocs(query(col, orderBy(field, "desc")));
      break;
    } catch {
      /* index ou champ absent */
    }
  }
  if (!snap) {
    snap = await getDocs(col);
  }

  const rawRows: Array<{ id: string; data: Record<string, unknown> }> = [];
  snap.forEach((d) => {
    rawRows.push({ id: d.id, data: d.data() as Record<string, unknown> });
  });

  const userIds = new Set<string>();
  for (const r of rawRows) {
    const uid = pickFirst(r.data, ["userId", "uid", "idUtilisateur", "user"]);
    if (typeof uid === "string" && uid.trim()) userIds.add(uid.trim());
  }

  const userMap = new Map<string, Record<string, unknown>>();
  await Promise.all(
    [...userIds].map(async (uid) => {
      const s = await getDoc(doc(db, USERS_COLLECTION, uid));
      if (s.exists()) userMap.set(uid, s.data() as Record<string, unknown>);
    })
  );

  const rows: ReservationAdminRow[] = rawRows.map(({ id, data }) => {
    const uidRaw = pickFirst(data, ["userId", "uid", "idUtilisateur", "user"]);
    const uid =
      typeof uidRaw === "string" && uidRaw.trim() ? uidRaw.trim() : null;
    const userData = uid ? userMap.get(uid) : undefined;
    return normalizeReservationDoc(id, data, userData);
  });

  rows.sort((a, b) => {
    const ta = a.heureReservation?.getTime() ?? 0;
    const tb = b.heureReservation?.getTime() ?? 0;
    return tb - ta;
  });

  return rows;
}

export async function loadReservationById(
  db: Firestore,
  id: string
): Promise<ReservationAdminRow | null> {
  const snap = await getDoc(doc(db, RESERVATIONS_COLLECTION, id));
  if (!snap.exists()) return null;

  const data = snap.data() as Record<string, unknown>;
  let userData: Record<string, unknown> | undefined;
  const uidRaw = pickFirst(data, ["userId", "uid", "idUtilisateur", "user"]);
  const uid =
    typeof uidRaw === "string" && uidRaw.trim() ? uidRaw.trim() : null;
  if (uid) {
    const userSnap = await getDoc(doc(db, USERS_COLLECTION, uid));
    if (userSnap.exists()) {
      userData = userSnap.data() as Record<string, unknown>;
    }
  }
  return normalizeReservationDoc(id, data, userData);
}

export async function setReservationEtat(
  db: Firestore,
  row: Pick<ReservationAdminRow, "id" | "etatFieldName">,
  etat: string
): Promise<void> {
  const ref = doc(db, RESERVATIONS_COLLECTION, row.id);
  await updateDoc(ref, {
    [row.etatFieldName]: etat.trim(),
    updatedAt: serverTimestamp(),
  });
}

export async function setReservationPrisEnCharge(
  db: Firestore,
  row: Pick<ReservationAdminRow, "id" | "etatFieldName">
): Promise<void> {
  await setReservationEtat(db, row, TAKE_CHARGE_ETAT);
}

/** True si la demande est encore « En attente » (bouton « Prendre en charge »). */
export function reservationNeedsTakeCharge(etat: string): boolean {
  const t = normalizeReservationEtatKey(etat);
  if (!t || t === "—") return true;
  return t === "en attente";
}

export async function deleteReservationDoc(
  db: Firestore,
  reservationId: string
): Promise<void> {
  await deleteDoc(doc(db, RESERVATIONS_COLLECTION, reservationId));
}
