"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PROMO_COLLECTION,
  deletePartnerPromo,
  loadPartnerPromoRows,
  type PartnerPromoRow,
} from "@/lib/partnerPromoAdmin";
import { AdminTableShell } from "@/components/admin/AdminTableShell";
import { getFirebaseFirestore } from "@/lib/firebase";
import { firebaseMessage } from "@/lib/firebaseError";

type SortKey = "poids" | "code" | "collectes";
type SortDir = "asc" | "desc";

function compare(a: PartnerPromoRow, b: PartnerPromoRow, key: SortKey): number {
  switch (key) {
    case "poids":
      return (a.poidsKg ?? -1) - (b.poidsKg ?? -1);
    case "code":
      return a.code.localeCompare(b.code, "fr");
    case "collectes":
      return a.collectes - b.collectes;
    default:
      return 0;
  }
}

export default function AdminPartenairesPage() {
  const [rows, setRows] = useState<PartnerPromoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("code");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await loadPartnerPromoRows(getFirebaseFirestore());
      setRows(list);
    } catch (err) {
      setError(
        `Impossible de charger les codes — ${firebaseMessage(err)}. Collection « ${PROMO_COLLECTION} ».`
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = useMemo(() => {
    const list = [...rows];
    list.sort((a, b) => {
      const c = compare(a, b, sortKey);
      return sortDir === "asc" ? c : -c;
    });
    return list;
  }, [rows, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "code" ? "asc" : "desc");
    }
  }

  async function handleDelete(id: string, code: string) {
    if (!window.confirm(`Supprimer le code « ${code} » ?`)) return;
    setError(null);
    setBusyId(id);
    try {
      await deletePartnerPromo(getFirebaseFirestore(), id);
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(`Suppression impossible — ${firebaseMessage(err)}`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-[1000px]">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-lobster text-3xl text-[#10294B] sm:text-4xl">
            Codes partenaires
          </h1>
          <p className="mt-2 text-slate-600">
            Collection Firestore{" "}
            <code className="rounded bg-slate-100 px-1 text-xs">{PROMO_COLLECTION}</code>.
          </p>
        </div>
        <Link
          href="/admin/partenaires/nouveau"
          className="inline-flex min-h-[46px] items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
        >
          + Créer un code partenaire
        </Link>
      </header>

      {error ? (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="py-16 text-center text-slate-600">Chargement…</p>
      ) : sorted.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 py-16 text-center text-slate-600">
          Aucun code ou droits insuffisants.
        </p>
      ) : (
        <AdminTableShell>
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90">
                {(
                  [
                    ["poids", "POIDS"],
                    ["code", "CODE"],
                    ["collectes", "COLLECTES"],
                  ] as const
                ).map(([key, label]) => (
                  <th key={key} className="px-4 py-3 text-xs font-bold uppercase text-[#10294B]">
                    <button
                      type="button"
                      onClick={() => toggleSort(key)}
                      className="inline-flex items-center gap-1"
                    >
                      {label}
                      <span className="text-slate-400">
                        {sortKey === key ? (sortDir === "asc" ? "↑" : "↓") : "⇅"}
                      </span>
                    </button>
                  </th>
                ))}
                <th className="px-4 py-3 text-xs font-bold uppercase text-[#10294B]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                  <td className="px-4 py-3 tabular-nums font-medium text-slate-800">
                    {r.poidsDisplay}
                  </td>
                  <td className="px-4 py-3 font-mono text-sm font-bold text-[#10294B]">
                    {r.code}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">
                    {r.collectes}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/admin/partenaires/${encodeURIComponent(r.id)}`}
                        className="inline-flex rounded-lg border border-[#10294B]/25 bg-[#10294B]/10 px-2.5 py-1.5 text-xs font-bold text-[#10294B] hover:bg-[#10294B]/15"
                      >
                        Modifier
                      </Link>
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => void handleDelete(r.id, r.code)}
                        className="inline-flex rounded-lg border border-[#CE2029]/30 px-2.5 py-1.5 text-xs font-bold text-[#CE2029] hover:bg-red-50 disabled:opacity-50"
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTableShell>
      )}
    </div>
  );
}
