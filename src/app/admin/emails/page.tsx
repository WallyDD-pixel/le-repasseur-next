"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  EMAILS_COLLECTION,
  STATUT_VERIFIE,
  deleteAdminEmailDoc,
  loadAdminEmailRows,
  markEmailVerified,
  type AdminEmailRow,
} from "@/lib/emailsAdmin";
import { getFirebaseAuth, getFirebaseFirestore } from "@/lib/firebase";
import { firebaseMessage } from "@/lib/firebaseError";

type SortKey = "email" | "statut" | "date";
type SortDir = "asc" | "desc";
type FilterStatut = "__all__" | "verifie" | "non";

function formatDate(d: Date | null): string {
  if (!d) return "N/A";
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statutBadgeClass(statut: string): string {
  if (statut === STATUT_VERIFIE || statut.toLowerCase().includes("vérifi"))
    return "bg-emerald-100 text-emerald-900 ring-emerald-200";
  return "bg-amber-100 text-amber-900 ring-amber-200";
}

function escapeCsvCell(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function compareRows(a: AdminEmailRow, b: AdminEmailRow, key: SortKey): number {
  switch (key) {
    case "email":
      return a.email.localeCompare(b.email, "fr");
    case "statut":
      return a.statut.localeCompare(b.statut, "fr");
    case "date":
      return (a.dateAjout?.getTime() ?? 0) - (b.dateAjout?.getTime() ?? 0);
    default:
      return 0;
  }
}

function joinUrl(base: string, path: string): string {
  const b = base.trim().replace(/\/+$/, "");
  const p = path.trim().replace(/^\/+/, "");
  return p ? `${b}/${p}` : b;
}

export default function AdminEmailsPage() {
  const [rows, setRows] = useState<AdminEmailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hookInfo, setHookInfo] = useState<string | null>(null);

  const [hookBase, setHookBase] = useState("");
  const [pathVerify, setPathVerify] = useState("verifySmtp");
  const [pathSend, setPathSend] = useState("sendTestEmail");
  const [testTo, setTestTo] = useState("");
  const [testSubject, setTestSubject] = useState("");
  const [testBody, setTestBody] = useState("<p>Votre message…</p>");
  const [hookBusy, setHookBusy] = useState<"verify" | "send" | null>(null);

  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState<FilterStatut>("__all__");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await loadAdminEmailRows(getFirebaseFirestore());
      setRows(list);
    } catch (err) {
      setError(
        `Impossible de charger « ${EMAILS_COLLECTION} » — ${firebaseMessage(err)}.`
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
    if (filterStatut === "verifie") {
      list = list.filter(
        (r) =>
          r.statut === STATUT_VERIFIE ||
          r.statut.toLowerCase().includes("vérifi")
      );
    } else if (filterStatut === "non") {
      list = list.filter(
        (r) =>
          r.statut !== STATUT_VERIFIE &&
          !r.statut.toLowerCase().includes("vérifi")
      );
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const hay = [r.email, r.statut, formatDate(r.dateAjout)].join(" ").toLowerCase();
        return hay.includes(q);
      });
    }
    return list;
  }, [rows, search, filterStatut]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      const c = compareRows(a, b, sortKey);
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

  async function callHook(path: string, payload: Record<string, unknown>) {
    const url = joinUrl(hookBase, path);
    if (!hookBase.trim()) {
      setHookInfo("Indiquez l’URL du serveur hook (ex. votre Cloud Function).");
      return;
    }
    try {
      const u = getFirebaseAuth().currentUser;
      if (!u) {
        setHookInfo("Session expirée — rechargez la page puis reconnectez-vous.");
        return;
      }
      const idToken = await u.getIdToken();
      const res = await fetch("/api/admin/email-hook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ url, payload }),
      });
      const data = (await res.json()) as { ok?: boolean; status?: number; body?: string; error?: string };
      if (!res.ok) {
        setHookInfo(`Échec : ${data.error ?? res.statusText}`);
        return;
      }
      setHookInfo(
        `HTTP ${data.status ?? "?" } — ${(data.body ?? "").slice(0, 500)}${(data.body?.length ?? 0) > 500 ? "…" : ""}`
      );
    } catch (e) {
      setHookInfo(firebaseMessage(e));
    }
  }

  async function handleVerifySmtp() {
    setHookInfo(null);
    setHookBusy("verify");
    try {
      await callHook(pathVerify, {});
    } finally {
      setHookBusy(null);
    }
  }

  async function handleSendTest() {
    setHookInfo(null);
    setHookBusy("send");
    try {
      await callHook(pathSend, {
        to: testTo.trim(),
        subject: testSubject.trim(),
        html: testBody,
      });
    } finally {
      setHookBusy(null);
    }
  }

  async function handleVerifyRow(r: AdminEmailRow) {
    setError(null);
    setRowBusy(r.id);
    try {
      await markEmailVerified(getFirebaseFirestore(), r);
      setRows((prev) =>
        prev.map((x) =>
          x.id === r.id
            ? { ...x, statut: STATUT_VERIFIE, statutIsBoolean: x.statutIsBoolean }
            : x
        )
      );
    } catch (err) {
      setError(`Vérification impossible — ${firebaseMessage(err)}`);
    } finally {
      setRowBusy(null);
    }
  }

  async function handleDeleteRow(id: string, email: string) {
    if (!window.confirm(`Supprimer l’entrée « ${email} » ?`)) return;
    setError(null);
    setRowBusy(id);
    try {
      await deleteAdminEmailDoc(getFirebaseFirestore(), id);
      setRows((prev) => prev.filter((x) => x.id !== id));
    } catch (err) {
      setError(`Suppression impossible — ${firebaseMessage(err)}`);
    } finally {
      setRowBusy(null);
    }
  }

  function exportCsv() {
    const header = ["EMAIL", "STATUT", "DATE D'AJOUT"];
    const lines = [header.join(";")];
    for (const r of sorted) {
      lines.push(
        [
          escapeCsvCell(r.email),
          escapeCsvCell(r.statut),
          escapeCsvCell(formatDate(r.dateAjout)),
        ].join(";")
      );
    }
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u;
    a.download = `emails-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(u);
  }

  return (
    <div className="mx-auto max-w-[1100px]">
      <header className="mb-8">
        <h1 className="font-lobster text-3xl text-[#10294B] sm:text-4xl">
          Gestion des emails
        </h1>
      </header>

      <section className="mb-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-[#10294B]">Envoi d&apos;emails par SMTP</h2>
        <p className="mt-1 text-sm text-slate-600">
          Testez la connexion et envoyez un email via votre Cloud Function (chemins
          à aligner sur votre backend).
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              URL de base (hook)
            </label>
            <input
              value={hookBase}
              onChange={(e) => setHookBase(e.target.value)}
              placeholder="https://us-central1-….cloudfunctions.net"
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-slate-500">Chemin vérification SMTP</label>
              <input
                value={pathVerify}
                onChange={(e) => setPathVerify(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">Chemin envoi test</label>
              <input
                value={pathSend}
                onChange={(e) => setPathSend(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>
          <button
            type="button"
            disabled={!!hookBusy}
            onClick={() => void handleVerifySmtp()}
            className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {hookBusy === "verify" ? "…" : null} Vérifier la connexion SMTP
          </button>
          <div className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-500">Destinataire</label>
              <input
                type="email"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="email@exemple.com"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-500">Sujet</label>
              <input
                value={testSubject}
                onChange={(e) => setTestSubject(e.target.value)}
                placeholder="Sujet du message"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-500">Message (HTML possible)</label>
              <textarea
                value={testBody}
                onChange={(e) => setTestBody(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm"
              />
            </div>
          </div>
          <button
            type="button"
            disabled={!!hookBusy}
            onClick={() => void handleSendTest()}
            className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {hookBusy === "send" ? "…" : null} Envoyer l&apos;email
          </button>
          {hookInfo ? (
            <pre className="max-h-40 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700 whitespace-pre-wrap">
              {hookInfo}
            </pre>
          ) : null}
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold text-[#10294B]">Liste des emails</h2>
          <p className="text-sm text-slate-600">
            Total : <span className="font-semibold tabular-nums">{filtered.length}</span>
          </p>
        </div>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <input
            type="search"
            placeholder="Rechercher un email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-h-[46px] w-full max-w-md rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm outline-none focus:ring-4 focus:ring-[#CE2029]/15"
          />
          <select
            value={filterStatut}
            onChange={(e) => setFilterStatut(e.target.value as FilterStatut)}
            className="min-h-[46px] rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-[#10294B]"
          >
            <option value="__all__">Tous</option>
            <option value="non">Non vérifiés</option>
            <option value="verifie">Vérifiés</option>
          </select>
          <button
            type="button"
            disabled={sorted.length === 0}
            onClick={exportCsv}
            className="inline-flex min-h-[46px] items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#10294B] shadow-sm disabled:opacity-50"
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
          <p className="py-12 text-center text-slate-600">Chargement…</p>
        ) : sorted.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 py-12 text-center text-slate-600">
            Aucune entrée ou filtres trop stricts.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[700px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90">
                  {(
                    [
                      ["email", "EMAIL"],
                      ["statut", "STATUT"],
                      ["date", "DATE AJOUT"],
                    ] as const
                  ).map(([key, label]) => (
                    <th key={key} className="px-4 py-3 text-xs font-bold uppercase text-[#10294B]">
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
                  <th className="px-4 py-3 text-xs font-bold uppercase text-[#10294B]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className="px-4 py-3 text-slate-800">{r.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${statutBadgeClass(r.statut)}`}
                      >
                        {r.statut}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">
                      {formatDate(r.dateAjout)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={
                            rowBusy === r.id ||
                            r.statut === STATUT_VERIFIE ||
                            r.statut.toLowerCase().includes("vérifi")
                          }
                          onClick={() => void handleVerifyRow(r)}
                          className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Vérifier
                        </button>
                        <button
                          type="button"
                          disabled={rowBusy === r.id}
                          onClick={() => void handleDeleteRow(r.id, r.email)}
                          className="rounded-lg border border-[#CE2029]/30 px-2.5 py-1.5 text-xs font-bold text-[#CE2029] hover:bg-red-50 disabled:opacity-50"
                        >
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
