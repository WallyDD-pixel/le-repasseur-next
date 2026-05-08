"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  TRANSACTIONS_COLLECTION,
  loadActiviteSiteRows,
  type ActiviteSiteRow,
} from "@/lib/activiteAdmin";
import { getFirebaseFirestore } from "@/lib/firebase";

type SortKey =
  | "date"
  | "type"
  | "titre"
  | "client"
  | "email"
  | "montant"
  | "numero"
  | "abonnement";
type SortDir = "asc" | "desc";

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

function formatActiviteDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleString("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  });
}

function typeBadgeClass(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("renouvel"))
    return "bg-blue-100 text-blue-900 ring-blue-200";
  if (l.includes("produit"))
    return "bg-violet-100 text-violet-900 ring-violet-200";
  if (l.includes("abonnement"))
    return "bg-emerald-100 text-emerald-900 ring-emerald-200";
  if (l.includes("paiement"))
    return "bg-amber-100 text-amber-900 ring-amber-200";
  return "bg-slate-100 text-slate-800 ring-slate-200";
}

function escapeCsvCell(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function rowsToCsv(rows: ActiviteSiteRow[]): string {
  const header = [
    "DATE",
    "TYPE",
    "TITRE",
    "CLIENT",
    "EMAIL",
    "MONTANT",
    "N° CLIENT",
    "ABONNEMENT",
  ];
  const lines = [header.join(";")];
  for (const r of rows) {
    lines.push(
      [
        escapeCsvCell(formatActiviteDate(r.date)),
        escapeCsvCell(r.typeLabel),
        escapeCsvCell(r.titre),
        escapeCsvCell(r.client),
        escapeCsvCell(r.email),
        escapeCsvCell(
          r.montantEuros != null ? String(r.montantEuros) : r.montantDisplay
        ),
        escapeCsvCell(r.numeroClient),
        escapeCsvCell(r.abonnementDisplay),
      ].join(";")
    );
  }
  return "\uFEFF" + lines.join("\r\n");
}

function compareRows(a: ActiviteSiteRow, b: ActiviteSiteRow, key: SortKey): number {
  switch (key) {
    case "date": {
      const ta = a.date?.getTime() ?? 0;
      const tb = b.date?.getTime() ?? 0;
      return ta - tb;
    }
    case "montant": {
      const ma = a.montantEuros ?? -Infinity;
      const mb = b.montantEuros ?? -Infinity;
      return ma - mb;
    }
    case "type":
      return a.typeLabel.localeCompare(b.typeLabel, "fr");
    case "titre":
      return a.titre.localeCompare(b.titre, "fr");
    case "client":
      return a.client.localeCompare(b.client, "fr");
    case "email":
      return a.email.localeCompare(b.email, "fr");
    case "numero":
      return a.numeroClient.localeCompare(b.numeroClient, "fr");
    case "abonnement":
      return a.abonnementDisplay.localeCompare(b.abonnementDisplay, "fr");
    default:
      return 0;
  }
}

export default function AdminActivitePage() {
  const [rows, setRows] = useState<ActiviteSiteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("__all__");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [pageSize, setPageSize] = useState<number>(25);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const db = getFirebaseFirestore();
      const list = await loadActiviteSiteRows(db);
      setRows(list);
    } catch {
      setError(
        `Impossible de charger l’activité (Firestore / droits). Vérifiez les collections « ${TRANSACTIONS_COLLECTION} » et « users », ainsi que les règles de sécurité.`
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const typeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(r.typeLabel);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows;
    if (typeFilter !== "__all__") {
      list = list.filter((r) => r.typeLabel === typeFilter);
    }
    if (q) {
      list = list.filter((r) => {
        const hay = [
          r.typeLabel,
          r.titre,
          r.client,
          r.email,
          r.numeroClient,
          r.abonnementDisplay,
          formatActiviteDate(r.date),
          r.montantDisplay,
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    return list;
  }, [rows, search, typeFilter]);

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
  }, [search, typeFilter, sortKey, sortDir, pageSize]);

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
      setSortDir(key === "date" || key === "montant" ? "desc" : "asc");
    }
  }

  function exportCsv() {
    const blob = new Blob([rowsToCsv(sorted)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activite-site-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="mb-8">
        <h1 className="font-lobster text-3xl text-[#10294B] sm:text-4xl">
          Activité du site
        </h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Journal des transactions (paiements Stripe, renouvellements,
          abonnements…). Collection Firestore{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[13px]">
            {TRANSACTIONS_COLLECTION}
          </code>{" "}
          ; fiches client via{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[13px]">
            users
          </code>{" "}
          (<code className="text-[13px]">userId</code>).
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <label className="sr-only" htmlFor="activite-search">
            Rechercher
          </label>
          <input
            id="activite-search"
            type="search"
            placeholder="Rechercher une activité…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-h-[46px] w-full min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none ring-[#CE2029]/15 focus:border-[#10294B]/35 focus:ring-4 sm:max-w-md"
          />
          <label className="sr-only" htmlFor="activite-type">
            Type
          </label>
          <select
            id="activite-type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="min-h-[46px] rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-[#10294B] shadow-sm outline-none focus:border-[#10294B]/35 focus:ring-4 focus:ring-[#CE2029]/15 sm:w-auto"
          >
            <option value="__all__">Tous les types</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="activite-page-size">
            Lignes par page
          </label>
          <select
            id="activite-page-size"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="min-h-[46px] rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-[#10294B] shadow-sm outline-none focus:border-[#10294B]/35 focus:ring-4 focus:ring-[#CE2029]/15 sm:w-auto"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={sorted.length === 0}
          className="inline-flex min-h-[46px] shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-[#10294B] shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
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
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          Exporter
        </button>
      </div>

      {error ? (
        <p className="mb-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-100">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div
            className="h-10 w-10 animate-spin rounded-full border-2 border-[#10294B]/25 border-t-[#10294B]"
            aria-hidden
          />
          <p className="text-sm font-medium text-slate-600">Chargement…</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-16 text-center">
          <p className="text-slate-600">
            {rows.length === 0
              ? `Aucune entrée dans « ${TRANSACTIONS_COLLECTION} » ou collection vide.`
              : "Aucun résultat pour ces filtres."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[1000px] w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90">
                  {(
                    [
                      ["date", "DATE"],
                      ["type", "TYPE"],
                      ["titre", "TITRE"],
                      ["client", "CLIENT"],
                      ["email", "EMAIL"],
                      ["montant", "MONTANT"],
                      ["numero", "N° CLIENT"],
                      ["abonnement", "ABONNEMENT"],
                    ] as const
                  ).map(([key, label]) => (
                    <th key={key} className="px-4 py-3 font-bold text-[#10294B]">
                      <button
                        type="button"
                        onClick={() => toggleSort(key)}
                        className="inline-flex items-center gap-1.5 rounded-lg px-1 py-0.5 text-xs uppercase tracking-wide hover:bg-slate-100"
                      >
                        {label}
                        <span className="tabular-nums text-slate-400">
                          {sortKey === key ? (sortDir === "asc" ? "↑" : "↓") : "⇅"}
                        </span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-slate-100 transition hover:bg-slate-50/80"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      {formatActiviteDate(r.date)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${typeBadgeClass(r.typeLabel)}`}
                      >
                        {r.typeLabel}
                      </span>
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-slate-800">
                      {r.titre}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-slate-700">
                      {r.client}
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-slate-600">
                      {r.email}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium tabular-nums text-slate-900">
                      {r.montantDisplay}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-700">
                      {r.numeroClient}
                    </td>
                    <td className="max-w-[280px] px-4 py-3 text-xs leading-snug text-slate-600">
                      {r.abonnementDisplay}
                    </td>
                  </tr>
                ))}
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
              {filtered.length !== rows.length ||
              search ||
              typeFilter !== "__all__" ? (
                <span className="text-slate-500">
                  {" "}
                  ({rows.length} transaction{rows.length !== 1 ? "s" : ""} chargée
                  {rows.length !== 1 ? "s" : ""})
                </span>
              ) : null}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#10294B] shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
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
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#10294B] shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
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
