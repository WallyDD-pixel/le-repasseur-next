"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CONTACT_MESSAGE_COLLECTIONS,
  deleteContactMessage,
  displayMessageDate,
  displayMessageDateLong,
  loadContactMessageRows,
  type AdminContactMessageRow,
} from "@/lib/contactMessagesAdmin";
import { AdminTableShell } from "@/components/admin/AdminTableShell";
import { getFirebaseFirestore } from "@/lib/firebase";
import { firebaseMessage } from "@/lib/firebaseError";

type SortKey = "nom" | "prenom" | "email" | "telephone" | "message" | "date";
type SortDir = "asc" | "desc";

function escapeCsvCell(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function compare(a: AdminContactMessageRow, b: AdminContactMessageRow, key: SortKey): number {
  switch (key) {
    case "date": {
      const ta = a.date?.getTime() ?? 0;
      const tb = b.date?.getTime() ?? 0;
      if (ta !== tb) return ta - tb;
      return (a.dateRaw ?? "").localeCompare(b.dateRaw ?? "", "fr");
    }
    case "nom":
      return a.nom.localeCompare(b.nom, "fr");
    case "prenom":
      return a.prenom.localeCompare(b.prenom, "fr");
    case "email":
      return a.email.localeCompare(b.email, "fr");
    case "telephone":
      return a.telephone.localeCompare(b.telephone, "fr");
    case "message":
      return a.message.localeCompare(b.message, "fr");
    default:
      return 0;
  }
}

export default function AdminMessagesPage() {
  const [rows, setRows] = useState<AdminContactMessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminContactMessageRow | null>(null);

  useEffect(() => {
    if (!selected) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSelected(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await loadContactMessageRows(getFirebaseFirestore());
      setRows(list);
    } catch (err) {
      setError(
        `Impossible de charger les messages — ${firebaseMessage(err)}. Collections : ${CONTACT_MESSAGE_COLLECTIONS.join(", ")}.`
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
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = [
        r.nom,
        r.prenom,
        r.email,
        r.telephone,
        r.message,
        displayMessageDate(r),
        r.dateRaw ?? "",
        r.sourceCollection,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      const c = compare(a, b, sortKey);
      return sortDir === "asc" ? c : -c;
    });
    return list;
  }, [filtered, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "date" ? "desc" : "asc");
    }
  }

  function exportCsv() {
    const header = ["DATE", "NOM", "PRÉNOM", "EMAIL", "TÉLÉPHONE", "MESSAGE", "COLLECTION"];
    const lines = [header.join(";")];
    for (const r of sorted) {
      lines.push(
        [
          escapeCsvCell(displayMessageDate(r)),
          escapeCsvCell(r.nom),
          escapeCsvCell(r.prenom),
          escapeCsvCell(r.email),
          escapeCsvCell(r.telephone),
          escapeCsvCell(r.message),
          escapeCsvCell(r.sourceCollection),
        ].join(";")
      );
    }
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u;
    a.download = `messages-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(u);
  }

  async function handleDelete(r: AdminContactMessageRow) {
    if (
      !window.confirm(
        `Supprimer ce message de « ${r.prenom} ${r.nom} » ?`
      )
    )
      return;
    setError(null);
    const bid = `${r.sourceCollection}/${r.id}`;
    setActionBusy(bid);
    try {
      await deleteContactMessage(
        getFirebaseFirestore(),
        r.sourceCollection,
        r.id
      );
      setRows((prev) => prev.filter((x) => !(x.id === r.id && x.sourceCollection === r.sourceCollection)));
      setSelected((s) =>
        s && s.id === r.id && s.sourceCollection === r.sourceCollection ? null : s
      );
    } catch (err) {
      setError(`Suppression impossible — ${firebaseMessage(err)}`);
    } finally {
      setActionBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <header className="mb-8">
        <h1 className="font-lobster text-3xl text-[#10294B] sm:text-4xl">
          Messages
        </h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Documents des collections{" "}
          <code className="rounded bg-slate-100 px-1 text-xs">
            {CONTACT_MESSAGE_COLLECTIONS.join(" » et « ")}
          </code>
          .
        </p>
      </header>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <input
          type="search"
          placeholder="Rechercher un message…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-h-[46px] w-full min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm outline-none ring-[#CE2029]/15 focus:border-[#10294B]/35 focus:ring-4 sm:max-w-md"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className={`inline-flex min-h-[46px] items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold shadow-sm ${
              filtersOpen
                ? "border-[#10294B] bg-[#10294B]/10 text-[#10294B]"
                : "border-slate-200 bg-white text-[#10294B] hover:bg-slate-50"
            }`}
          >
            Filtrer
          </button>
          <button
            type="button"
            disabled={sorted.length === 0}
            onClick={exportCsv}
            className="inline-flex min-h-[46px] items-center rounded-xl border border-[#10294B]/25 bg-[#10294B] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#10294B]/90 disabled:opacity-50"
          >
            Exporter
          </button>
        </div>
      </div>
      {filtersOpen ? (
        <p className="mb-4 text-sm text-slate-600">
          Triez par colonne ; la recherche porte sur tout le texte visible. Cliquez
          sur une ligne pour lire le message en entier.
        </p>
      ) : null}
      {error ? (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center text-slate-600">
          Chargement…
        </div>
      ) : sorted.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 px-6 py-16 text-center text-slate-600">
          Aucun message ou collections vides / droits insuffisants.
        </p>
      ) : (
        <AdminTableShell>
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90">
                {(
                  [
                    ["date", "DATE"],
                    ["nom", "NOM"],
                    ["prenom", "PRÉNOM"],
                    ["email", "EMAIL"],
                    ["telephone", "TÉLÉPHONE"],
                    ["message", "MESSAGE"],
                  ] as const
                ).map(([key, label]) => (
                  <th key={key} className="px-3 py-3 text-xs font-bold uppercase text-[#10294B]">
                    <button
                      type="button"
                      onClick={() => toggleSort(key)}
                      className="inline-flex items-center gap-1 hover:text-[#CE2029]"
                    >
                      {label}
                      <span className="text-slate-400">
                        {sortKey === key ? (sortDir === "asc" ? "↑" : "↓") : "⇅"}
                      </span>
                    </button>
                  </th>
                ))}
                <th className="px-3 py-3 text-xs font-bold uppercase text-[#10294B]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const bid = `${r.sourceCollection}/${r.id}`;
                return (
                  <tr
                    key={bid}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelected(r)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelected(r);
                      }
                    }}
                    className="cursor-pointer border-b border-slate-100 transition hover:bg-[#10294B]/[0.04]"
                  >
                    <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                      {displayMessageDate(r)}
                    </td>
                    <td className="max-w-[120px] truncate px-3 py-2">{r.nom}</td>
                    <td className="max-w-[120px] truncate px-3 py-2">{r.prenom}</td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-slate-600">
                      {r.email}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">{r.telephone}</td>
                    <td className="max-w-[320px] truncate px-3 py-2 text-slate-700" title={r.message}>
                      <span className="text-[#10294B] underline decoration-[#10294B]/30 underline-offset-2">
                        {r.message}
                      </span>
                    </td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        disabled={actionBusy === bid}
                        onClick={() => void handleDelete(r)}
                        className="rounded-lg border border-[#CE2029]/30 px-2 py-1 text-xs font-bold text-[#CE2029] hover:bg-red-50 disabled:opacity-50"
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </AdminTableShell>
      )}

      {selected ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="message-detail-title"
        >
          <button
            type="button"
            aria-label="Fermer"
            className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
            onClick={() => setSelected(null)}
          />
          <div className="relative max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2
                  id="message-detail-title"
                  className="font-lobster text-2xl text-[#10294B]"
                >
                  Détail du message
                </h2>
                <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  Date du message
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800 tabular-nums">
                  {displayMessageDateLong(selected)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Fermer
              </button>
            </div>
            <dl className="grid gap-2 border-b border-slate-100 pb-4 text-sm">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <dt className="font-semibold text-slate-500">Nom</dt>
                <dd className="text-slate-900">
                  {selected.prenom} {selected.nom}
                </dd>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <dt className="font-semibold text-slate-500">Email</dt>
                <dd>
                  <a
                    href={`mailto:${selected.email.replace(/^mailto:/i, "")}`}
                    className="text-[#10294B] underline decoration-[#10294B]/25"
                  >
                    {selected.email}
                  </a>
                </dd>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <dt className="font-semibold text-slate-500">Téléphone</dt>
                <dd className="text-slate-900">{selected.telephone}</dd>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <dt className="font-semibold text-slate-500">Collection</dt>
                <dd className="font-mono text-xs text-slate-600">
                  {selected.sourceCollection} / {selected.id}
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-xs font-bold uppercase tracking-wide text-[#10294B]">
              Message
            </p>
            <div className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-800">
              {selected.message}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
