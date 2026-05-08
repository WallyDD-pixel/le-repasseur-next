"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RESERVATIONS_COLLECTION,
  TAKE_CHARGE_ETAT,
  deleteReservationDoc,
  isLingeRestitueLabel,
  loadReservationRows,
  setReservationPrisEnCharge,
  type ReservationAdminRow,
} from "@/lib/reservationsAdmin";
import { getFirebaseFirestore } from "@/lib/firebase";
import { firebaseMessage } from "@/lib/firebaseError";

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

type SortKey =
  | "heure"
  | "nom"
  | "prenom"
  | "dateReservation"
  | "dateRetour"
  | "kg"
  | "role"
  | "etat"
  | "telephone";
type SortDir = "asc" | "desc";

function formatHeureReservation(d: Date | null): string {
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
function formatCreneau(
  d: Date | null,
  firestoreDisplay?: string | null
): string {
  if (firestoreDisplay && firestoreDisplay.trim()) return firestoreDisplay.trim();
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

function escapeCsvCell(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function etatBadgeClass(etat: string): string {
  const t = etat.toLowerCase();
  if (t.includes("restitu"))
    return "bg-emerald-100 text-emerald-900 ring-emerald-200";
  if (
    t.includes("pris") ||
    t.includes("charge") ||
    t.includes("cours") ||
    t.includes("traitement")
  )
    return "bg-sky-100 text-sky-900 ring-sky-200";
  return "bg-slate-100 text-slate-800 ring-slate-200";
}

function compareRows(
  a: ReservationAdminRow,
  b: ReservationAdminRow,
  key: SortKey
): number {
  switch (key) {
    case "heure": {
      const ta = a.heureReservation?.getTime() ?? 0;
      const tb = b.heureReservation?.getTime() ?? 0;
      return ta - tb;
    }
    case "nom":
      return a.nom.localeCompare(b.nom, "fr");
    case "prenom":
      return a.prenom.localeCompare(b.prenom, "fr");
    case "dateReservation": {
      const ta = a.dateReservation?.getTime() ?? 0;
      const tb = b.dateReservation?.getTime() ?? 0;
      return ta - tb;
    }
    case "dateRetour": {
      const ta = a.dateRetour?.getTime() ?? 0;
      const tb = b.dateRetour?.getTime() ?? 0;
      return ta - tb;
    }
    case "kg": {
      const ka = a.kg ?? -Infinity;
      const kb = b.kg ?? -Infinity;
      return ka - kb;
    }
    case "role":
      return a.role.localeCompare(b.role, "fr");
    case "etat":
      return a.etat.localeCompare(b.etat, "fr");
    case "telephone":
      return a.telephone.localeCompare(b.telephone, "fr");
    default:
      return 0;
  }
}

export default function AdminReservationsPage() {
  const [rows, setRows] = useState<ReservationAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [hideRestitue, setHideRestitue] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("heure");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [actionBusy, setActionBusy] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const db = getFirebaseFirestore();
      const list = await loadReservationRows(db);
      setRows(list);
    } catch (err) {
      setError(
        `Impossible de charger les demandes — ${firebaseMessage(err)}. Vérifiez la collection « ${RESERVATIONS_COLLECTION} » et les règles Firestore.`
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    let list = rows;
    if (hideRestitue) {
      list = list.filter((r) => !isLingeRestitueLabel(r.etat));
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const hay = [
          formatHeureReservation(r.heureReservation),
          r.nom,
          r.prenom,
          formatCreneau(r.dateReservation, r.dateReservationDisplay),
          formatCreneau(r.dateRetour, r.dateRetourDisplay),
          r.kgDisplay,
          r.role,
          r.etat,
          r.telephone,
          r.numeroCommande,
          r.activite,
          r.codePostal,
          r.adresseCollecte,
          r.adresseRetour,
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    return list;
  }, [rows, search, hideRestitue]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      const c = compareRows(a, b, sortKey);
      return sortDir === "asc" ? c : -c;
    });
    return list;
  }, [filtered, sortKey, sortDir]);

  const totalFiltered = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));

  useEffect(() => {
    setPage(1);
  }, [search, hideRestitue, pageSize, sortKey, sortDir]);

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  const rangeStart = totalFiltered === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalFiltered);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      const descFirst =
        key === "heure" ||
        key === "dateReservation" ||
        key === "dateRetour" ||
        key === "kg";
      setSortDir(descFirst ? "desc" : "asc");
    }
  }

  function exportCsv() {
    const header = [
      "HEURE RÉSERVATION",
      "NOM",
      "PRÉNOM",
      "DATE RÉSERVATION",
      "DATE RETOUR",
      "KG",
      "RÔLE",
      "ÉTAT",
      "TÉLÉPHONE",
      "N° COMMANDE",
      "ACTIVITÉ",
      "CODE POSTAL",
      "ADRESSE COLLECTE",
      "ADRESSE RETOUR",
    ];
    const lines = [header.join(";")];
    for (const r of sorted) {
      lines.push(
        [
          escapeCsvCell(formatHeureReservation(r.heureReservation)),
          escapeCsvCell(r.nom),
          escapeCsvCell(r.prenom),
          escapeCsvCell(
            formatCreneau(r.dateReservation, r.dateReservationDisplay)
          ),
          escapeCsvCell(formatCreneau(r.dateRetour, r.dateRetourDisplay)),
          escapeCsvCell(r.kgDisplay),
          escapeCsvCell(r.role),
          escapeCsvCell(r.etat),
          escapeCsvCell(r.telephone),
          escapeCsvCell(r.numeroCommande),
          escapeCsvCell(r.activite),
          escapeCsvCell(r.codePostal),
          escapeCsvCell(r.adresseCollecte),
          escapeCsvCell(r.adresseRetour),
        ].join(";")
      );
    }
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `demandes-reservation-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleTakeCharge(r: ReservationAdminRow) {
    setError(null);
    setActionBusy((m) => ({ ...m, [r.id]: "take" }));
    try {
      const db = getFirebaseFirestore();
      await setReservationPrisEnCharge(db, r);
      setRows((prev) =>
        prev.map((row) =>
          row.id === r.id
            ? {
                ...row,
                etat: TAKE_CHARGE_ETAT,
              }
            : row
        )
      );
    } catch (err) {
      setError(`Prise en charge impossible — ${firebaseMessage(err)}`);
    } finally {
      setActionBusy((m) => {
        const { [r.id]: _, ...rest } = m;
        return rest;
      });
    }
  }

  async function handleDelete(r: ReservationAdminRow) {
    if (
      !window.confirm(
        `Supprimer la demande de réservation pour « ${r.prenom} ${r.nom} » ?`
      )
    ) {
      return;
    }
    setError(null);
    setActionBusy((m) => ({ ...m, [r.id]: "del" }));
    try {
      const db = getFirebaseFirestore();
      await deleteReservationDoc(db, r.id);
      setRows((prev) => prev.filter((row) => row.id !== r.id));
    } catch (err) {
      setError(`Suppression impossible — ${firebaseMessage(err)}`);
    } finally {
      setActionBusy((m) => {
        const { [r.id]: _, ...rest } = m;
        return rest;
      });
    }
  }

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="mb-8">
        <h1 className="font-lobster text-3xl text-[#10294B] sm:text-4xl">
          Demandes de réservation
        </h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Liste des documents Firestore{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[13px]">
            {RESERVATIONS_COLLECTION}
          </code>{" "}
          (<code className="rounded bg-slate-100 px-1.5 py-0.5 text-[13px]">
            heureReservation
          </code>
          ,{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[13px]">
            dateHeureReservation
          </code>
          , etc.).
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <label className="inline-flex min-h-[46px] cursor-pointer select-none items-center gap-2 text-sm font-medium text-[#10294B]">
              <input
                type="checkbox"
                checked={hideRestitue}
                onChange={(e) => setHideRestitue(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#10294B] focus:ring-[#CE2029]/40"
              />
              Masquer &apos;Linge restitué&apos;
            </label>
            <input
              type="search"
              placeholder="Rechercher…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-h-[46px] w-full min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm outline-none ring-[#CE2029]/15 focus:border-[#10294B]/35 focus:ring-4 sm:max-w-md"
              aria-label="Recherche"
            />
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="min-h-[46px] rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-[#10294B] shadow-sm outline-none focus:ring-4 focus:ring-[#CE2029]/15"
              aria-label="Pagination"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              className={`inline-flex min-h-[46px] items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold shadow-sm transition ${
                filtersOpen
                  ? "border-[#10294B] bg-[#10294B]/10 text-[#10294B]"
                  : "border-slate-200 bg-white text-[#10294B] hover:bg-slate-50"
              }`}
              aria-pressed={filtersOpen}
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
              Filtrer
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={sorted.length === 0}
              className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-[#10294B]/25 bg-[#10294B] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#10294B]/90 disabled:opacity-50"
            >
              Exporter
            </button>
          </div>
        </div>
        {filtersOpen ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Astuce : combinez la recherche texte et la case « Masquer Linge
            restitué » pour affiner la liste. Les en-têtes de colonnes permettent
            de trier.
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="mb-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-100">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div
            className="h-10 w-10 animate-spin rounded-full border-2 border-[#10294B]/25 border-t-[#10294B]"
            aria-hidden
          />
          <p className="text-sm font-medium text-slate-600">Chargement…</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-16 text-center text-slate-600">
          {rows.length === 0
            ? `Aucune demande dans « ${RESERVATIONS_COLLECTION} » ou droits insuffisants.`
            : "Aucun résultat pour ces filtres."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[1200px] w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90">
                  {(
                    [
                      ["heure", "HEURE RÉSERVATION", ""],
                      ["nom", "NOM", ""],
                      ["prenom", "PRÉNOM", ""],
                      ["dateReservation", "DATE RÉSERVATION", ""],
                      ["dateRetour", "DATE RETOUR", ""],
                      ["kg", "KG", ""],
                      ["role", "RÔLE", ""],
                      ["etat", "ÉTAT", ""],
                      ["telephone", "TÉLÉPHONE", ""],
                    ] as const
                  ).map(([key, label, thClass]) => (
                    <th
                      key={key}
                      className={`whitespace-nowrap px-3 py-3 text-xs font-bold uppercase tracking-wide text-[#10294B] ${thClass}`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(key)}
                        className="inline-flex items-center gap-1.5 rounded-lg px-1 py-0.5 hover:bg-slate-100"
                      >
                        {label}
                        <span className="tabular-nums text-slate-400">
                          {sortKey === key
                            ? sortDir === "asc"
                              ? "↑"
                              : "↓"
                            : "⇅"}
                        </span>
                      </button>
                    </th>
                  ))}
                  <th className="whitespace-nowrap px-3 py-3 text-xs font-bold uppercase tracking-wide text-[#10294B]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((r) => {
                  const busy = actionBusy[r.id];
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-slate-100 transition hover:bg-slate-50/80"
                    >
                      <td className="whitespace-nowrap px-3 py-3 tabular-nums text-slate-700">
                        {formatHeureReservation(r.heureReservation)}
                      </td>
                      <td className="max-w-[120px] truncate px-3 py-3 font-medium text-slate-900">
                        {r.nom}
                      </td>
                      <td className="max-w-[120px] truncate px-3 py-3 text-slate-800">
                        {r.prenom}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                        {formatCreneau(
                          r.dateReservation,
                          r.dateReservationDisplay
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                        {formatCreneau(r.dateRetour, r.dateRetourDisplay)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 tabular-nums text-slate-800">
                        {r.kgDisplay}
                      </td>
                      <td className="max-w-[140px] truncate px-3 py-3 text-slate-700">
                        {r.role}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${etatBadgeClass(r.etat)}`}
                        >
                          {r.etat}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                        {r.telephone}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={!!busy}
                            onClick={() => void handleTakeCharge(r)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#10294B]/25 bg-[#10294B]/[0.08] px-2.5 py-1.5 text-xs font-bold text-[#10294B] transition hover:bg-[#10294B]/15 disabled:opacity-50"
                          >
                            {busy === "take" ? "…" : null}
                            Prendre en charge
                          </button>
                          <button
                            type="button"
                            disabled={!!busy}
                            onClick={() => void handleDelete(r)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#CE2029]/30 bg-white px-2.5 py-1.5 text-xs font-bold text-[#CE2029] transition hover:bg-[#CE2029]/[0.06] disabled:opacity-50"
                          >
                            {busy === "del" ? "…" : null}
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <p className="text-xs text-slate-600">
              <span className="font-medium tabular-nums text-[#10294B]">
                {totalFiltered === 0
                  ? "Aucune ligne"
                  : `Affichage ${rangeStart}–${rangeEnd} sur ${totalFiltered}`}
              </span>
              {rows.length !== totalFiltered ? (
                <span className="text-slate-500">
                  {" "}
                  ({rows.length} au chargement)
                </span>
              ) : null}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#10294B] shadow-sm disabled:opacity-40"
              >
                Précédent
              </button>
              <span className="tabular-nums text-xs text-slate-600">
                Page {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#10294B] shadow-sm disabled:opacity-40"
              >
                Suivant
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
