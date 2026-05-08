import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  type Firestore,
} from "firebase/firestore";

/**
 * Un document = un créneau réel (date + heure début/fin).
 * Pas de motif hebdomadaire : chaque créneau est indépendant.
 */
export const DISP_SLOTS_COLLECTION = "disponibilites";

/** Ancienne app Flutter / Admin : un seul document imbriqué par dates et jours français. */
export const AVAILABILITY_COLLECTION = "availability";
export const AVAILABILITY_DOC_ID = "availability";

/** Durée affichée pour chaque entrée `intervals` (heure de début seule en base). */
export const LEGACY_INTERVAL_DURATION_MINUTES = 30;

const FR_WEEKDAY_KEYS = [
  "dimanche",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
] as const;

export function formatYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function frenchWeekdayKey(d: Date): string {
  return FR_WEEKDAY_KEYS[d.getDay()]!;
}

function parseYmdLocal(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== mo ||
    dt.getDate() !== d
  ) {
    return null;
  }
  return startOfLocalDay(dt);
}

/** ID stable pour un créneau issu du document `availability/availability`. */
export function encodeLegacySlotId(
  dateStr: string,
  dayFr: string,
  hm: string
): string {
  return `legacy|${dateStr}|${dayFr}|${hm}`;
}

export function decodeLegacySlotId(
  id: string
): { dateStr: string; dayFr: string; hm: string } | null {
  if (!id.startsWith("legacy|")) return null;
  const rest = id.slice("legacy|".length);
  const i = rest.indexOf("|");
  const j = rest.indexOf("|", i + 1);
  if (i <= 0 || j <= i) return null;
  const dateStr = rest.slice(0, i);
  const dayFr = rest.slice(i + 1, j);
  const hm = rest.slice(j + 1);
  if (!dateStr || !dayFr || !hm) return null;
  return { dateStr, dayFr, hm };
}

type LegacyAvailabilityTree = Record<
  string,
  Record<string, { intervals?: Array<string | number> }>
>;

/**
 * Recopie uniquement la structure date → jour → intervals connue, sans JSON.stringify
 * (Timestamps / types Firebase cassent souvent le clone JSON et peuvent vider l’arbre).
 */
function sanitizeAvailabilityTree(raw: unknown): LegacyAvailabilityTree {
  if (!raw || typeof raw !== "object") return {};
  const out: LegacyAvailabilityTree = {};
  for (const [dateStr, dayBlock] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;
    if (!dayBlock || typeof dayBlock !== "object") continue;
    const block: Record<string, { intervals: Array<string | number> }> = {};
    for (const [dayKey, payload] of Object.entries(dayBlock as Record<string, unknown>)) {
      if (!payload || typeof payload !== "object") continue;
      const p = payload as Record<string, unknown>;
      const iv = p.intervals ?? p.interval;
      const intervals: Array<string | number> = [];
      if (Array.isArray(iv)) {
        for (const x of iv) {
          if (typeof x === "string" || typeof x === "number") intervals.push(x);
        }
      } else if (typeof iv === "string") {
        intervals.push(iv);
      }
      if (intervals.length === 0) continue;
      block[dayKey] = { intervals };
    }
    if (Object.keys(block).length > 0) out[dateStr] = block;
  }
  return out;
}

/**
 * Lit `availability.availability.{YYYY-MM-DD}.{lundi|…}.intervals[]` (heures de début uniquement).
 */
export function parseLegacyAvailabilityDoc(
  docData: Record<string, unknown>,
  slotDurationMinutes = LEGACY_INTERVAL_DURATION_MINUTES
): DisponibiliteSlot[] {
  const root = docData.availability;
  if (!root || typeof root !== "object") return [];

  const out: DisponibiliteSlot[] = [];

  for (const [dateStr, dayBlock] of Object.entries(
    root as Record<string, unknown>
  )) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;
    const baseDay = parseYmdLocal(dateStr);
    if (!baseDay) continue;

    if (!dayBlock || typeof dayBlock !== "object") continue;

    for (const [dayFr, payload] of Object.entries(
      dayBlock as Record<string, unknown>
    )) {
      const p = payload as Record<string, unknown>;
      const raw = p.intervals ?? p.interval;
      const intervals = Array.isArray(raw)
        ? raw
        : typeof raw === "string"
          ? [raw]
          : [];
      for (const t of intervals) {
        const hm = legacyIntervalToHm(t);
        if (!hm) continue;
        const start = applyTimeOnDate(baseDay, hm);
        const end = new Date(
          start.getTime() + slotDurationMinutes * 60 * 1000
        );
        const id = encodeLegacySlotId(dateStr, dayFr.toLowerCase(), hm);
        out.push({ id, start, end });
      }
    }
  }

  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

function dedupeSlotsByStartMinute(slots: DisponibiliteSlot[]): DisponibiliteSlot[] {
  const seen = new Set<number>();
  const out: DisponibiliteSlot[] = [];
  for (const s of slots) {
    const k = Math.floor(s.start.getTime() / 60000);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

/** Charge les créneaux « modernes » + le document legacy `availability/availability`. */
export async function loadMergedAvailabilitySlots(
  db: Firestore
): Promise<DisponibiliteSlot[]> {
  const modern = await loadAllDisponibiliteSlots(db);
  let legacy: DisponibiliteSlot[] = [];
  try {
    const snap = await getDoc(
      doc(db, AVAILABILITY_COLLECTION, AVAILABILITY_DOC_ID)
    );
    if (snap.exists()) {
      legacy = parseLegacyAvailabilityDoc(
        snap.data() as Record<string, unknown>
      );
    }
  } catch {
    /* règles / réseau */
  }
  const merged = [...legacy, ...modern];
  merged.sort((a, b) => a.start.getTime() - b.start.getTime());
  return dedupeSlotsByStartMinute(merged);
}

async function readAvailabilityTree(
  db: Firestore
): Promise<LegacyAvailabilityTree> {
  const snap = await getDoc(
    doc(db, AVAILABILITY_COLLECTION, AVAILABILITY_DOC_ID)
  );
  if (!snap.exists()) return {};
  const d = snap.data() as Record<string, unknown>;
  const raw = d.availability;
  if (!raw || typeof raw !== "object") return {};
  try {
    return structuredClone(raw) as LegacyAvailabilityTree;
  } catch {
    try {
      return JSON.parse(JSON.stringify(raw)) as LegacyAvailabilityTree;
    } catch {
      return sanitizeAvailabilityTree(raw);
    }
  }
}

async function writeAvailabilityTree(
  db: Firestore,
  tree: LegacyAvailabilityTree
): Promise<void> {
  const ref = doc(db, AVAILABILITY_COLLECTION, AVAILABILITY_DOC_ID);
  const snap = await getDoc(ref);
  /**
   * Ne pas utiliser setDoc(..., { merge: true }) pour `availability` : Firestore
   * fusionne les maps **en profondeur**, donc omettre une date dans `tree` ne
   * supprime pas cette date en base — les créneaux « supprimés » réapparaissent.
   * updateDoc remplace le champ `availability` entièrement.
   */
  if (!snap.exists()) {
    await setDoc(ref, {
      availability: tree,
      updatedAt: serverTimestamp(),
    });
  } else {
    await updateDoc(ref, {
      availability: tree,
      updatedAt: serverTimestamp(),
    });
  }
}

function resolveDayKey(
  dateBlock: Record<string, { intervals?: Array<string | number> }>,
  dayFr: string
): string | null {
  const t = dayFr.toLowerCase();
  for (const k of Object.keys(dateBlock)) {
    if (k.toLowerCase() === t) return k;
  }
  return null;
}

/** Accepte chaîne ou nombre type 1700 selon les imports Flutter. */
function legacyIntervalToHm(x: unknown): string | null {
  if (typeof x === "string") return normalizeHm(x);
  if (typeof x === "number" && Number.isFinite(x)) {
    if (x >= 100 && x <= 2359) {
      const h = Math.floor(x / 100);
      const min = x % 100;
      if (h >= 0 && h < 24 && min >= 0 && min < 60)
        return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    }
    return null;
  }
  return null;
}

/** Retire une heure de début sur une date, quel que soit le libellé du jour en base (Flutter peut varier). */
function removeLegacyHmFromDate(
  tree: LegacyAvailabilityTree,
  dateStr: string,
  hm: string
): void {
  const block = tree[dateStr];
  if (!block) return;
  for (const dayKey of Object.keys(block)) {
    const day = block[dayKey];
    if (!day?.intervals?.length) continue;
    day.intervals = day.intervals.filter((x) => legacyIntervalToHm(x) !== hm);
    if (day.intervals.length === 0) delete block[dayKey];
  }
  if (Object.keys(block).length === 0) delete tree[dateStr];
}

function upsertLegacyInterval(
  tree: LegacyAvailabilityTree,
  dateStr: string,
  dayFr: string,
  hm: string
): void {
  const n = normalizeHm(hm);
  if (!n) return;
  if (!tree[dateStr]) tree[dateStr] = {};
  const block = tree[dateStr]!;
  const existingDayKey = resolveDayKey(block, dayFr);
  const dayKey = existingDayKey ?? dayFr.toLowerCase();
  if (!block[dayKey]) block[dayKey] = { intervals: [] };
  const arr = block[dayKey].intervals!;
  if (!arr.some((x) => legacyIntervalToHm(x) === n)) arr.push(n);
  arr.sort((a, b) => {
    const ha = legacyIntervalToHm(a);
    const hb = legacyIntervalToHm(b);
    if (!ha || !hb) return 0;
    return hmToMinutes(ha) - hmToMinutes(hb);
  });
}

/** Nouveau créneau dans le format legacy (intervals = heures de début). */
export async function createLegacyAvailabilitySlot(
  db: Firestore,
  dayAnchor: Date,
  startHm: string
): Promise<string> {
  const dateStr = formatYmdLocal(dayAnchor);
  const dayFr = frenchWeekdayKey(dayAnchor);
  const hm = normalizeHm(startHm);
  if (!hm) throw new Error("heure invalide");
  const tree = await readAvailabilityTree(db);
  upsertLegacyInterval(tree, dateStr, dayFr, hm);
  await writeAvailabilityTree(db, tree);
  return encodeLegacySlotId(dateStr, dayFr, hm);
}

export async function deleteLegacyAvailabilitySlot(
  db: Firestore,
  slotId: string
): Promise<void> {
  const dec = decodeLegacySlotId(slotId);
  if (!dec) throw new Error("id legacy invalide");
  const hm = normalizeHm(dec.hm);
  if (!hm) throw new Error("heure invalide");
  const tree = await readAvailabilityTree(db);
  removeLegacyHmFromDate(tree, dec.dateStr, hm);
  await writeAvailabilityTree(db, tree);
}

export async function updateLegacyAvailabilitySlot(
  db: Firestore,
  slotId: string,
  newStart: Date
): Promise<string> {
  const dec = decodeLegacySlotId(slotId);
  if (!dec) throw new Error("id legacy invalide");
  const oldHm = normalizeHm(dec.hm);
  if (!oldHm) throw new Error("heure invalide");
  const dateStr = formatYmdLocal(startOfLocalDay(newStart));
  const dayFr = frenchWeekdayKey(newStart);
  const newHm = normalizeHm(
    `${String(newStart.getHours()).padStart(2, "0")}:${String(newStart.getMinutes()).padStart(2, "0")}`
  );
  if (!newHm) throw new Error("heure invalide");

  const tree = await readAvailabilityTree(db);
  removeLegacyHmFromDate(tree, dec.dateStr, oldHm);
  upsertLegacyInterval(tree, dateStr, dayFr, newHm);
  await writeAvailabilityTree(db, tree);
  return encodeLegacySlotId(dateStr, dayFr, newHm);
}

export type DisponibiliteSlot = {
  id: string;
  start: Date;
  end: Date;
};

/**
 * Normalise une heure « HH:mm » ou « HH:mm:ss » (souvent en base Firebase / Flutter).
 */
export function normalizeHm(raw: string): string | null {
  const t = raw.trim();
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(t);
  if (!m) return null;
  let h = Number(m[1]);
  let min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Compare « HH:mm » */
export function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

export function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Applique une heure locale « HH:mm » sur un jour (minuit local). */
export function applyTimeOnDate(dayAtMidnight: Date, hm: string): Date {
  const n = normalizeHm(hm);
  if (!n) return new Date(dayAtMidnight);
  const [h, min] = n.split(":").map(Number);
  const out = new Date(dayAtMidnight);
  out.setHours(h, min, 0, 0);
  return out;
}

function coerceDate(v: unknown): Date | null {
  if (v == null) return null;
  if (v instanceof Timestamp) return v.toDate();
  if (
    typeof v === "object" &&
    v !== null &&
    "toDate" in v &&
    typeof (v as { toDate?: () => Date }).toDate === "function"
  ) {
    return (v as { toDate: () => Date }).toDate();
  }
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === "number") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Lit un créneau depuis un document Firestore (champs variables selon les apps legacy).
 */
export function parseSlotDocument(
  id: string,
  data: Record<string, unknown>
): DisponibiliteSlot | null {
  const startRaw =
    data.start ??
    data.startAt ??
    data.dateDebut ??
    data.startTime ??
    data.dateStart;
  const endRaw =
    data.end ?? data.endAt ?? data.dateFin ?? data.endTime ?? data.dateEnd;

  let start = coerceDate(startRaw);
  let end = coerceDate(endRaw);

  const hd =
    typeof data.heureDebut === "string"
      ? data.heureDebut
      : typeof data.startHour === "string"
        ? data.startHour
        : null;
  const hf =
    typeof data.heureFin === "string"
      ? data.heureFin
      : typeof data.endHour === "string"
        ? data.endHour
        : null;
  if ((!start || !end) && hd && hf) {
    const base =
      coerceDate(data.jour) ??
      coerceDate(data.date) ??
      coerceDate(data.day) ??
      (typeof data.jour === "string" ? new Date(data.jour) : null);
    if (base && !Number.isNaN(base.getTime())) {
      const d0 = startOfLocalDay(base);
      if (!start) start = applyTimeOnDate(d0, hd);
      if (!end) end = applyTimeOnDate(d0, hf);
    }
  }

  if (!start || !end || end.getTime() <= start.getTime()) return null;
  return { id, start, end };
}

export async function loadAllDisponibiliteSlots(
  db: Firestore
): Promise<DisponibiliteSlot[]> {
  const snap = await getDocs(collection(db, DISP_SLOTS_COLLECTION));
  const out: DisponibiliteSlot[] = [];
  snap.forEach((d) => {
    const slot = parseSlotDocument(d.id, d.data() as Record<string, unknown>);
    if (slot) out.push(slot);
  });
  out.sort((a, b) => a.start.getTime() - b.start.getTime());
  return out;
}

function formatHm(d: Date): string {
  return d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Préfixe IDs passés à FullCalendar (évite `|` et caractères invalides en DOM/CSS). */
const CALENDAR_UI_EVENT_PREFIX = "lr-slot-";

/** ID sûr pour FullCalendar ; le vrai id Firestore reste dans `extendedProps.slotId`. */
export function calendarUiEventId(slotId: string): string {
  return `${CALENDAR_UI_EVENT_PREFIX}${encodeURIComponent(slotId)}`;
}

export function slotIdFromCalendarUiEventId(fcEventId: string): string | null {
  if (!fcEventId.startsWith(CALENDAR_UI_EVENT_PREFIX)) return null;
  try {
    return decodeURIComponent(fcEventId.slice(CALENDAR_UI_EVENT_PREFIX.length));
  } catch {
    return null;
  }
}

export function slotsToCalendarEvents(
  slots: DisponibiliteSlot[],
  rangeStart: Date,
  rangeEnd: Date
): Array<{
  id: string;
  title: string;
  start: Date;
  end: Date;
  extendedProps: { slotId: string };
}> {
  const rs = rangeStart.getTime();
  const re = rangeEnd.getTime();
  return slots
    .filter((s) => s.start.getTime() < re && s.end.getTime() > rs)
    .map((s) => ({
      id: calendarUiEventId(s.id),
      title: `${formatHm(s.start)} – ${formatHm(s.end)}`,
      start: s.start,
      end: s.end,
      extendedProps: { slotId: s.id },
    }));
}

export async function createSlot(
  db: Firestore,
  start: Date,
  end: Date
): Promise<string> {
  const ref = await addDoc(collection(db, DISP_SLOTS_COLLECTION), {
    start: Timestamp.fromDate(start),
    end: Timestamp.fromDate(end),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateSlot(
  db: Firestore,
  slotId: string,
  start: Date,
  end: Date
): Promise<void> {
  await updateDoc(doc(db, DISP_SLOTS_COLLECTION, slotId), {
    start: Timestamp.fromDate(start),
    end: Timestamp.fromDate(end),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteSlot(db: Firestore, slotId: string): Promise<void> {
  await deleteDoc(doc(db, DISP_SLOTS_COLLECTION, slotId));
}

/** Même jour civil local + même heure:minute locales (évite les décalages minute entre sources). */
function slotMatchesLocalClock(
  s: DisponibiliteSlot,
  anchor: Date
): boolean {
  return (
    formatYmdLocal(s.start) === formatYmdLocal(anchor) &&
    s.start.getHours() === anchor.getHours() &&
    s.start.getMinutes() === anchor.getMinutes()
  );
}

/**
 * Supprime un créneau après fusion legacy + collection `disponibilites`.
 * Sans cela, un doublon (même minute locale dans les deux sources) peut survivre
 * car la vue ne montre qu’un seul bloc après déduplication.
 */
export async function deleteMergedAvailabilitySlot(
  db: Firestore,
  slotId: string,
  anchorStart: Date
): Promise<void> {
  const modern = await loadAllDisponibiliteSlots(db);
  for (const s of modern) {
    if (slotMatchesLocalClock(s, anchorStart)) {
      await deleteDoc(doc(db, DISP_SLOTS_COLLECTION, s.id));
    }
  }

  if (decodeLegacySlotId(slotId)) {
    await deleteLegacyAvailabilitySlot(db, slotId);
    return;
  }

  const dateStr = formatYmdLocal(anchorStart);
  const dayFr = frenchWeekdayKey(anchorStart);
  const hm = normalizeHm(
    `${String(anchorStart.getHours()).padStart(2, "0")}:${String(anchorStart.getMinutes()).padStart(2, "0")}`
  );
  if (!hm) return;

  const legacyId = encodeLegacySlotId(dateStr, dayFr, hm);
  try {
    await deleteLegacyAvailabilitySlot(db, legacyId);
  } catch {
    /* pas d’entrée legacy pour cette minute */
  }
}
