"use client";

import FullCalendar from "@fullcalendar/react";
import frLocale from "@fullcalendar/core/locales/fr";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  applyTimeOnDate,
  createLegacyAvailabilitySlot,
  decodeLegacySlotId,
  deleteMergedAvailabilitySlot,
  hmToMinutes,
  LEGACY_INTERVAL_DURATION_MINUTES,
  loadMergedAvailabilitySlots,
  normalizeHm,
  slotIdFromCalendarUiEventId,
  slotsToCalendarEvents,
  startOfLocalDay,
  updateLegacyAvailabilitySlot,
  updateSlot,
  type DisponibiliteSlot,
} from "@/lib/disponibilitesAdmin";
import { firebaseMessage } from "@/lib/firebaseError";
import { getFirebaseFirestore } from "@/lib/firebase";
import { Input, Label, PrimaryButton } from "@/components/ui/FormField";

import "./disponibilites-calendar.css";

function dateToTimeInputValue(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatLongDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function parseEventDate(v: Date | string | null | undefined): Date | null {
  if (v == null) return null;
  if (v instanceof Date) return v;
  const x = new Date(v);
  return Number.isNaN(x.getTime()) ? null : x;
}

type Selection =
  | {
      slotId: string | null;
      day: Date;
      rangeStart: Date;
      rangeEnd: Date;
      isNew: boolean;
    }
  | null;

function isLegacySlotId(id: string): boolean {
  return id.startsWith("legacy|");
}

export function DisponibilitesManager() {
  const [slots, setSlots] = useState<DisponibiliteSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saveInfo, setSaveInfo] = useState<string | null>(null);

  const [visibleStart, setVisibleStart] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [visibleEnd, setVisibleEnd] = useState<Date>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    d.setHours(23, 59, 59, 999);
    return d;
  });

  const [selection, setSelection] = useState<Selection>(null);
  const [draftStart, setDraftStart] = useState("");
  const [draftEnd, setDraftEnd] = useState("");

  const reload = useCallback(async (options?: { quiet?: boolean }) => {
    const quiet = options?.quiet === true;
    if (!quiet) {
      setLoading(true);
      setLoadError(null);
    }
    try {
      const db = getFirebaseFirestore();
      const list = await loadMergedAvailabilitySlots(db);
      setSlots(list);
    } catch {
      setLoadError(
        "Impossible de charger les créneaux (Firestore ou règles d’accès)."
      );
    } finally {
      if (!quiet) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const events = useMemo(
    () =>
      slotsToCalendarEvents(slots, visibleStart, visibleEnd).map((e) => ({
        ...e,
        backgroundColor: "#10294B",
        borderColor: "#0d2140",
      })),
    [slots, visibleStart, visibleEnd]
  );

  const visibleSlotCount = events.length;

  const onDatesSet = useCallback((arg: { start: Date; end: Date }) => {
    setVisibleStart(arg.start);
    setVisibleEnd(arg.end);
  }, []);

  const eventClick = useCallback(
    (info: { event: { id: string; extendedProps: unknown; start: unknown; end: unknown } }) => {
      const ext = info.event.extendedProps as { slotId?: string };
      const slotId =
        ext.slotId ??
        slotIdFromCalendarUiEventId(info.event.id);
      const rs = parseEventDate(info.event.start as Date | string);
      const re = parseEventDate(info.event.end as Date | string);
      if (!slotId || !rs || !re) return;
      const day = startOfLocalDay(rs);
      setSelection({
        slotId,
        day,
        rangeStart: rs,
        rangeEnd: re,
        isNew: false,
      });
      setDraftStart(dateToTimeInputValue(rs));
      setDraftEnd(dateToTimeInputValue(re));
      setFormError(null);
      setSaveInfo(null);
    },
    []
  );

  const dateClick = useCallback((info: { date: Date }) => {
    const day = startOfLocalDay(info.date);
    setSelection({
      slotId: null,
      day,
      rangeStart: applyTimeOnDate(day, "17:00"),
      rangeEnd: applyTimeOnDate(day, "17:30"),
      isNew: true,
    });
    setDraftStart("17:00");
    setDraftEnd("17:30");
    setFormError(null);
    setSaveInfo(null);
  }, []);

  async function handleSave() {
    if (!selection) return;
    setFormError(null);
    setSaveInfo(null);
    const ds = normalizeHm(draftStart);
    const de = normalizeHm(draftEnd);
    if (!ds || !de) {
      setFormError("Indiquez des heures au format HH:mm.");
      return;
    }
    if (hmToMinutes(de) <= hmToMinutes(ds)) {
      setFormError("L’heure de fin doit être après l’heure de début.");
      return;
    }

    const anchorDay = startOfLocalDay(
      selection.isNew ? selection.day : selection.rangeStart
    );
    const newStart = applyTimeOnDate(anchorDay, ds);
    const newEnd = applyTimeOnDate(anchorDay, de);

    setSaving(true);
    try {
      const db = getFirebaseFirestore();
      if (selection.isNew) {
        const id = await createLegacyAvailabilitySlot(db, anchorDay, ds);
        await reload({ quiet: true });
        const rs = applyTimeOnDate(anchorDay, ds);
        const re = new Date(
          rs.getTime() + LEGACY_INTERVAL_DURATION_MINUTES * 60 * 1000
        );
        setSelection({
          slotId: id,
          day: anchorDay,
          rangeStart: rs,
          rangeEnd: re,
          isNew: false,
        });
        setSaveInfo(null);
      } else if (selection.slotId) {
        if (isLegacySlotId(selection.slotId)) {
          const prevDec = decodeLegacySlotId(selection.slotId);
          const prevHm = prevDec ? normalizeHm(prevDec.hm) : null;
          const newId = await updateLegacyAvailabilitySlot(
            db,
            selection.slotId,
            newStart
          );
          await reload({ quiet: true });
          setSelection({
            slotId: newId,
            day: startOfLocalDay(newStart),
            rangeStart: newStart,
            rangeEnd: newEnd,
            isNew: false,
          });
          if (prevHm && ds === prevHm) {
            setSaveInfo(
              "La base « intervals » n’enregistre que l’heure de début. Si vous avez seulement modifié l’heure de fin, la base ne change pas — ajustez l’heure de début pour déplacer le créneau."
            );
          } else {
            setSaveInfo(null);
          }
        } else {
          await updateSlot(db, selection.slotId, newStart, newEnd);
          await reload({ quiet: true });
          setSelection({
            slotId: selection.slotId,
            day: anchorDay,
            rangeStart: newStart,
            rangeEnd: newEnd,
            isNew: false,
          });
          setSaveInfo(null);
        }
      }
      setDraftStart(ds);
      setDraftEnd(de);
    } catch (err) {
      setFormError(`Enregistrement impossible — ${firebaseMessage(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selection?.slotId || selection.isNew) {
      setFormError(
        "Impossible de supprimer — recliquez le créneau sur le calendrier."
      );
      return;
    }
    setSaving(true);
    setFormError(null);
    setSaveInfo(null);
    try {
      const db = getFirebaseFirestore();
      await deleteMergedAvailabilitySlot(
        db,
        selection.slotId,
        selection.rangeStart
      );
      await reload({ quiet: true });
      setSelection(null);
      setDraftStart("");
      setDraftEnd("");
    } catch (err) {
      setFormError(`Suppression impossible — ${firebaseMessage(err)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#CE2029]">
            Sur cette vue
          </p>
          <p className="mt-1 flex flex-wrap items-baseline gap-2 text-slate-700">
            <span className="font-lobster text-4xl tabular-nums leading-none text-[#10294B]">
              {visibleSlotCount}
            </span>
            <span className="text-sm font-medium">
              créneau
              {visibleSlotCount !== 1 ? "x" : ""} affiché
              {visibleSlotCount !== 1 ? "s" : ""}
            </span>
          </p>
        </div>
        <p className="max-w-md text-xs leading-relaxed text-slate-500">
          Changez de mois avec les flèches si vos données sont sur une autre
          période (ex. année précédente).
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px] lg:items-start">
        <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_2px_28px_-10px_rgba(16,41,75,0.18)] ring-1 ring-slate-100">
          <div className="border-b border-slate-100 bg-gradient-to-r from-[#10294B]/[0.08] via-[#10294B]/[0.02] to-transparent px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#10294B]">
              Planning des collectes
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Vue mois, semaine ou jour — cliquez un jour vide pour ajouter, un
              bloc pour modifier.
            </p>
          </div>
          <div className="p-3 sm:p-5">
            {loading ? (
              <div className="flex min-h-[520px] flex-col items-center justify-center gap-4 rounded-xl bg-gradient-to-b from-slate-50 to-slate-100/70">
                <div
                  className="h-11 w-11 animate-spin rounded-full border-2 border-[#10294B]/25 border-t-[#10294B]"
                  aria-hidden
                />
                <p className="text-sm font-medium text-slate-600">
                  Chargement du planning…
                </p>
              </div>
            ) : loadError ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center gap-2 rounded-xl bg-red-50/90 px-6 text-center">
                <p className="max-w-md text-sm font-semibold text-red-900">
                  {loadError}
                </p>
              </div>
            ) : (
              <div className="disponibilites-calendar-wrap">
                <FullCalendar
                  plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                  initialView="dayGridMonth"
                  locale={frLocale}
                  headerToolbar={{
                    left: "prev,next today",
                    center: "title",
                    right: "dayGridMonth,timeGridWeek,timeGridDay",
                  }}
                  buttonText={{
                    today: "Aujourd'hui",
                    month: "Mois",
                    week: "Semaine",
                    day: "Jour",
                  }}
                  height="auto"
                  events={events}
                  eventClick={eventClick}
                  dateClick={dateClick}
                  datesSet={onDatesSet}
                  nowIndicator
                  slotMinTime="06:00:00"
                  slotMaxTime="22:00:00"
                  dayMaxEvents={4}
                  moreLinkText={(n) => `+ ${n} autres`}
                  eventDisplay="block"
                  eventContent={(arg) => (
                    <div className="fc-event-main-frame overflow-hidden px-0.5 py-px">
                      <span className="block truncate">{arg.event.title}</span>
                    </div>
                  )}
                />
              </div>
            )}
          </div>
        </section>

        <aside className="sticky top-6 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-[0_2px_28px_-10px_rgba(16,41,75,0.14)] ring-1 ring-slate-100">
            <h2 className="font-lobster text-2xl text-[#10294B]">
              Détail du créneau
            </h2>

            <details className="group mt-4 rounded-xl border border-slate-100 bg-slate-50/90 px-4 py-3 text-sm text-slate-600">
              <summary className="cursor-pointer list-none font-semibold text-[#10294B] outline-none [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-2">
                  Stockage Firestore
                  <span className="text-xs font-normal text-slate-400 transition group-open:rotate-180">
                    ▼
                  </span>
                </span>
              </summary>
              <p className="mt-3 text-xs leading-relaxed text-slate-600">
                Document{" "}
                <code className="rounded bg-white px-1.5 py-0.5 text-[11px] shadow-sm">
                  availability/availability
                </code>
                , champ{" "}
                <code className="rounded bg-white px-1 py-0.5 text-[11px]">
                  availability
                </code>
                , puis date (AAAA-MM-JJ), jour en français, liste{" "}
                <code className="rounded bg-white px-1 py-0.5 text-[11px]">
                  intervals
                </code>
                . Durée affichée par défaut :{" "}
                <strong>{LEGACY_INTERVAL_DURATION_MINUTES} min</strong> après
                chaque heure de début.
              </p>
            </details>

            {selection ? (
              <div className="mt-6 space-y-5 border-t border-slate-100 pt-6">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-semibold capitalize leading-snug text-slate-900">
                    {formatLongDate(selection.day)}
                  </p>
                  {selection.isNew ? (
                    <span className="rounded-full bg-[#CE2029]/10 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-[#CE2029]">
                      Nouveau
                    </span>
                  ) : (
                    <span className="rounded-full bg-[#10294B]/10 px-2.5 py-0.5 text-xs font-semibold text-[#10294B]">
                      Édition
                    </span>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="disp-start">Heure de début</Label>
                    <Input
                      id="disp-start"
                      type="time"
                      value={draftStart}
                      onChange={(ev) => {
                        setDraftStart(ev.target.value);
                        setSaveInfo(null);
                      }}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="disp-end">Heure de fin</Label>
                    <Input
                      id="disp-end"
                      type="time"
                      value={draftEnd}
                      onChange={(ev) => {
                        setDraftEnd(ev.target.value);
                        setSaveInfo(null);
                      }}
                      className="mt-1"
                    />
                  </div>
                </div>

                {formError ? (
                  <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-100">
                    {formError}
                  </p>
                ) : null}

                {saveInfo ? (
                  <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950 ring-1 ring-amber-100">
                    {saveInfo}
                  </p>
                ) : null}

                <div className="flex flex-col gap-3 pt-1">
                  <PrimaryButton
                    type="button"
                    loading={saving}
                    onClick={() => void handleSave()}
                  >
                    {selection.isNew ? "Ajouter le créneau" : "Enregistrer"}
                  </PrimaryButton>
                  {!selection.isNew ? (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void handleDelete()}
                      className="rounded-xl border-2 border-[#CE2029]/35 bg-white py-3 text-sm font-bold text-[#CE2029] shadow-sm transition hover:bg-[#CE2029]/[0.06] disabled:opacity-50"
                    >
                      Supprimer ce créneau
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="mt-6 space-y-4 border-t border-slate-100 pt-6">
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center">
                  <p className="text-sm font-medium text-slate-700">
                    Aucune sélection
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">
                    Cliquez une plage horaire sur le calendrier ou un jour vide
                    pour créer un créneau.
                  </p>
                </div>
                <p className="text-xs leading-relaxed text-slate-500">
                  Les créneaux issus de{" "}
                  <strong className="font-semibold text-slate-700">
                    availability
                  </strong>{" "}
                  sont fusionnés avec la collection{" "}
                  <strong className="font-semibold text-slate-700">
                    disponibilites
                  </strong>{" "}
                  (timestamps) si présents.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
