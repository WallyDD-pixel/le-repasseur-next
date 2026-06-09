"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RESILIATION_COLLECTION_CANDIDATES,
  RESILIATION_ETAT_ANNULEE,
  RESILIATION_ETAT_CONFIRMEE,
  loadResiliationRows,
  setResiliationEtat,
  type ResiliationAdminRow,
} from "@/lib/resiliationsAdmin";
import { AdminTableShell } from "@/components/admin/AdminTableShell";
import { getFirebaseFirestore } from "@/lib/firebase";
import { firebaseMessage } from "@/lib/firebaseError";

type SortKey = "date" | "nom" | "email" | "raison" | "message" | "etat";
type SortDir = "asc" | "desc";

function formatDate(d: Date | null): string {
  if (!d) return "N/A";
  return d.toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function escapeCsvCell(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function compare(a: ResiliationAdminRow, b: ResiliationAdminRow, key: SortKey): number {
  switch (key) {
    case "date":
      return (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0);
    case "nom":
      return `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, "fr");
    case "email":
      return a.email.localeCompare(b.email, "fr");
    case "raison":
      return a.raison.localeCompare(b.raison, "fr");
    case "message":
      return a.message.localeCompare(b.message, "fr");
    case "etat":
      return a.etat.localeCompare(b.etat, "fr");
    default:
      return 0;
  }
}

function etatClass(etat: string): string {
  const t = etat.toLowerCase();
  if (t.includes("confirm")) return "text-emerald-700 font-semibold";
  if (t.includes("annul")) return "text-red-700 font-semibold";
  return "text-slate-700";
}

export default function AdminResiliationsPage() {
  const [rows, setRows] = useState<ResiliationAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await loadResiliationRows(getFirebaseFirestore());
      setRows(list);
    } catch (err) {
      setError(
        `Impossible de charger les demandes — ${firebaseMessage(err)}. Cherché dans : ${RESILIATION_COLLECTION_CANDIDATES.join(", ")}.`
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
        r.raison,
        r.message,
        r.etat,
        formatDate(r.date),
        r.collectionId,
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

  function rowKey(r: ResiliationAdminRow) {
    return `${r.collectionId}/${r.id}`;
  }

  async function patchEtat(r: ResiliationAdminRow, etat: string) {
    setError(null);
    const k = rowKey(r);
    setBusyKey(k);
    try {
      await setResiliationEtat(getFirebaseFirestore(), r, etat);
      setRows((prev) =>
        prev.map((x) =>
          rowKey(x) === k ? { ...x, etat } : x
        )
      );
    } catch (err) {
      setError(`Mise à jour impossible — ${firebaseMessage(err)}`);
    } finally {
      setBusyKey(null);
    }
  }

  function exportCsv() {
    const header = ["DATE", "NOM", "PRÉNOM", "EMAIL", "RAISON", "MESSAGE", "ÉTAT", "COLLECTION"];
    const lines = [header.join(";")];
    for (const r of sorted) {
      lines.push(
        [
          escapeCsvCell(formatDate(r.date)),
          escapeCsvCell(r.nom),
          escapeCsvCell(r.prenom),
          escapeCsvCell(r.email),
          escapeCsvCell(r.raison),
          escapeCsvCell(r.message),
          escapeCsvCell(r.etat),
          escapeCsvCell(r.collectionId),
        ].join(";")
      );
    }
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u;
    a.download = `resiliations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(u);
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <header className="mb-8">
        <h1 className="font-lobster text-3xl text-[#10294B] sm:text-4xl">
          Demandes de résiliation
        </h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Agrégat des collections possibles :{" "}
          <code className="rounded bg-slate-100 px-1 text-xs">
            {RESILIATION_COLLECTION_CANDIDATES.join(", ")}
          </code>
          . Ajustez la liste dans{" "}
                    <code className="rounded bg-slate-100 px-1 text-xs">
                      resiliationsAdmin.ts
                    </code> si votre base utilise un autre nom.
        </p>
      </header>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <input
          type="search"
          placeholder="Rechercher…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-h-[46px] w-full max-w-md rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm outline-none focus:ring-4 focus:ring-[#CE2029]/15"
        />
        <button
          type="button"
          disabled={sorted.length === 0}
          onClick={exportCsv}
          className="inline-flex min-h-[46px] items-center rounded-xl border border-[#10294B]/25 bg-[#10294B] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Exporter
        </button>
      </div>

      {error ? (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="py-16 text-center text-slate-600">Chargement…</p>
      ) : sorted.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 py-16 text-center text-slate-600">
          Aucune demande ou collections vides. Vérifiez le nom exact de la
          collection dans Firestore.
        </p>
      ) : (
        <AdminTableShell>
          <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90">
                {(
                  [
                    ["date", "DATE"],
                    ["nom", "NOM / PRÉNOM"],
                    ["email", "EMAIL"],
                    ["raison", "RAISON"],
                    ["message", "MESSAGE"],
                    ["etat", "ÉTAT"],
                  ] as const
                ).map(([key, label]) => (
                  <th key={key} className="px-3 py-3 text-xs font-bold uppercase text-[#10294B]">
                    <button
                      type="button"
                      onClick={() => toggleSort(key as SortKey)}
                      className="inline-flex items-center gap-1"
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
                const k = rowKey(r);
                const busy = busyKey === k;
                return (
                  <tr key={k} className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                      {formatDate(r.date)}
                    </td>
                    <td className="px-3 py-2">
                      {r.prenom} {r.nom}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-slate-600">
                      {r.email}
                    </td>
                    <td className="max-w-[160px] truncate px-3 py-2" title={r.raison}>
                      {r.raison}
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-2" title={r.message}>
                      {r.message}
                    </td>
                    <td className={`px-3 py-2 ${etatClass(r.etat)}`}>{r.etat}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void patchEtat(r, RESILIATION_ETAT_CONFIRMEE)}
                          className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Confirmer
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void patchEtat(r, RESILIATION_ETAT_ANNULEE)}
                          className="rounded-lg bg-[#CE2029] px-2 py-1 text-xs font-bold text-white hover:bg-[#b91b24] disabled:opacity-50"
                        >
                          Annuler
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </AdminTableShell>
      )}
    </div>
  );
}
