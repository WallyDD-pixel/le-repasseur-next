"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { deleteDoc, doc } from "firebase/firestore";
import {
  loadAdminUserRows,
  loadSubscribedRoleNames,
  syncMissingInscriptionDates,
  USERS_COLLECTION,
  userSubscriptionTag,
  type AdminUserRow,
} from "@/lib/usersAdmin";
import { AdminTableShell } from "@/components/admin/AdminTableShell";
import { getFirebaseFirestore } from "@/lib/firebase";
import { firebaseMessage } from "@/lib/firebaseError";

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

type SortKey =
  | "inscription"
  | "nom"
  | "abonnement"
  | "email"
  | "telephone"
  | "codePostal"
  | "adresse1"
  | "adresse2"
  | "kg"
  | "reservations";
type SortDir = "asc" | "desc";

type RoleFilter = "__all__" | "admin" | "abonne" | "non_abonne";

function formatDateCourt(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function escapeCsvCell(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function subscriptionBadgeClass(tag: ReturnType<typeof userSubscriptionTag>): string {
  switch (tag) {
    case "admin":
      return "bg-sky-100 text-sky-900 ring-sky-200";
    case "abonne":
      return "bg-emerald-100 text-emerald-900 ring-emerald-200";
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

function subscriptionTagLabel(tag: ReturnType<typeof userSubscriptionTag>): string {
  switch (tag) {
    case "admin":
      return "Admin";
    case "abonne":
      return "Abonné";
    default:
      return "Non abonné";
  }
}

function subscriptionTagOrder(tag: ReturnType<typeof userSubscriptionTag>): number {
  switch (tag) {
    case "admin":
      return 0;
    case "abonne":
      return 1;
    default:
      return 2;
  }
}

function compareUserRows(
  a: AdminUserRow,
  b: AdminUserRow,
  key: SortKey,
  subscribedRoles: Set<string>
): number {
  switch (key) {
    case "inscription": {
      const ta = a.inscriptionDate?.getTime() ?? 0;
      const tb = b.inscriptionDate?.getTime() ?? 0;
      return ta - tb;
    }
    case "nom":
      return a.nomAffiche.localeCompare(b.nomAffiche, "fr");
    case "abonnement": {
      const oa = subscriptionTagOrder(
        userSubscriptionTag(a.role, subscribedRoles)
      );
      const ob = subscriptionTagOrder(
        userSubscriptionTag(b.role, subscribedRoles)
      );
      if (oa !== ob) return oa - ob;
      return a.role.localeCompare(b.role, "fr");
    }
    case "email":
      return a.email.localeCompare(b.email, "fr");
    case "telephone":
      return a.telephone.localeCompare(b.telephone, "fr");
    case "codePostal":
      return a.codePostal.localeCompare(b.codePostal, "fr");
    case "adresse1":
      return a.adresse1.localeCompare(b.adresse1, "fr");
    case "adresse2":
      return a.adresse2.localeCompare(b.adresse2, "fr");
    case "kg": {
      const ka = a.kg ?? -Infinity;
      const kb = b.kg ?? -Infinity;
      return ka - kb;
    }
    case "reservations":
      return a.reservations - b.reservations;
    default:
      return 0;
  }
}

export default function AdminUtilisateursPage() {
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [subscribedRoles, setSubscribedRoles] = useState<Set<string>>(
    () => new Set()
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("__all__");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("inscription");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const db = getFirebaseFirestore();
      const [list, roles] = await Promise.all([
        loadAdminUserRows(db),
        loadSubscribedRoleNames(db),
      ]);
      setRows(list);
      setSubscribedRoles(roles);
    } catch (err) {
      setError(
        `Impossible de charger les utilisateurs — ${firebaseMessage(err)}. Vérifiez la collection « ${USERS_COLLECTION} » et les règles Firestore.`
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
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const hay = [
          r.nomAffiche,
          r.email,
          r.role,
          r.telephone,
          r.codePostal,
          formatDateCourt(r.inscriptionDate),
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    if (roleFilter !== "__all__") {
      list = list.filter((r) => {
        const tag = userSubscriptionTag(r.role, subscribedRoles);
        return tag === roleFilter;
      });
    }
    return list;
  }, [rows, search, roleFilter, subscribedRoles]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      const c = compareUserRows(a, b, sortKey, subscribedRoles);
      return sortDir === "asc" ? c : -c;
    });
    return list;
  }, [filtered, sortKey, sortDir, subscribedRoles]);

  const totalFiltered = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, pageSize, sortKey, sortDir]);

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      const descFirst =
        key === "inscription" || key === "kg" || key === "reservations";
      setSortDir(descFirst ? "desc" : "asc");
    }
  }

  const rangeStart = totalFiltered === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalFiltered);

  async function handleDelete(id: string, label: string) {
    if (
      !window.confirm(
        `Supprimer l’utilisateur « ${label} » ?\n\nLe document Firestore sera retiré ; le compte Firebase Auth reste tant qu’il n’est pas supprimé depuis la console Firebase.`
      )
    ) {
      return;
    }
    try {
      await deleteDoc(doc(getFirebaseFirestore(), USERS_COLLECTION, id));
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(`Suppression impossible — ${firebaseMessage(err)}`);
    }
  }

  async function handleSyncDates() {
    setSyncMsg(null);
    setSyncBusy(true);
    try {
      const db = getFirebaseFirestore();
      const r = await syncMissingInscriptionDates(db);
      const total = r.filledFromCreatedAt + r.stampedManualProfiles;
      if (total === 0) {
        setSyncMsg(
          "Aucune mise à jour : tous les profils ont déjà « dateInscription » ou « inscriptionDate »."
        );
      } else {
        const parts: string[] = [];
        if (r.filledFromCreatedAt > 0) {
          parts.push(
            `${r.filledFromCreatedAt} profil(s) : « dateInscription » renseignée depuis « createdAt »`
          );
        }
        if (r.stampedManualProfiles > 0) {
          parts.push(
            `${r.stampedManualProfiles} profil(s) sans aucune date : « createdAt » et « dateInscription » fixés à maintenant (fiches manuelles)`
          );
        }
        setSyncMsg(parts.join(". ") + ".");
        await load();
      }
    } catch (err) {
      setSyncMsg(`Synchronisation impossible — ${firebaseMessage(err)}`);
    } finally {
      setSyncBusy(false);
    }
  }

  function exportCsv() {
    const header = [
      "DATE INSCRIPTION",
      "NOM / PRÉNOM",
      "RÔLE",
      "EMAIL",
      "TÉLÉPHONE",
      "CODE POSTAL",
      "ADRESSE 1",
      "ADRESSE 2",
      "KG",
      "RÉSERVATIONS",
    ];
    const lines = [header.join(";")];
    for (const r of sorted) {
      lines.push(
        [
          escapeCsvCell(formatDateCourt(r.inscriptionDate)),
          escapeCsvCell(r.nomAffiche),
          escapeCsvCell(r.role),
          escapeCsvCell(r.email),
          escapeCsvCell(r.telephone),
          escapeCsvCell(r.codePostal),
          escapeCsvCell(r.adresse1),
          escapeCsvCell(r.adresse2),
          escapeCsvCell(r.kgDisplay),
          escapeCsvCell(String(r.reservations)),
        ].join(";")
      );
    }
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `utilisateurs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="mb-8">
        <h1 className="font-lobster text-3xl text-[#10294B] sm:text-4xl">
          Liste des utilisateurs
        </h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Comptes stockés dans Firestore{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[13px]">
            {USERS_COLLECTION}
          </code>
          . La suppression retire uniquement le document utilisateur (pas le compte
          Auth sans action serveur).
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:flex-wrap xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <input
            type="search"
            placeholder="Rechercher un utilisateur…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-h-[46px] w-full min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm outline-none ring-[#CE2029]/15 focus:border-[#10294B]/35 focus:ring-4 sm:max-w-md"
            aria-label="Rechercher"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
            className="min-h-[46px] rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-[#10294B] shadow-sm outline-none focus:ring-4 focus:ring-[#CE2029]/15"
            aria-label="Filtrer par statut"
          >
            <option value="__all__">Tous les profils</option>
            <option value="admin">Admins</option>
            <option value="abonne">Abonnés (formule)</option>
            <option value="non_abonne">Non abonnés</option>
          </select>
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
            disabled={syncBusy}
            onClick={() => void handleSyncDates()}
            className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-[#10294B]/25 bg-[#10294B] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#10294B]/90 disabled:opacity-60"
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
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {syncBusy ? "Synchronisation…" : "Synchroniser les dates"}
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={sorted.length === 0}
            className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#10294B] shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            Exporter
          </button>
        </div>
      </div>

      {syncMsg ? (
        <p className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {syncMsg}
        </p>
      ) : null}

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
            ? "Aucun utilisateur dans Firestore."
            : "Aucun résultat pour ces filtres."}
        </div>
      ) : (
        <AdminTableShell
          footer={
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
          }
        >
            <table className="min-w-[1400px] w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90">
                  {(
                    [
                      ["inscription", "DATE D’INSCRIPTION", ""],
                      ["nom", "NOM / PRÉNOM", ""],
                      ["abonnement", "ABONNEMENT", ""],
                      ["email", "EMAIL", "min-w-[200px]"],
                      ["telephone", "TÉLÉPHONE", ""],
                      ["codePostal", "CODE POSTAL", ""],
                      ["adresse1", "ADRESSE 1", "min-w-[200px]"],
                      ["adresse2", "ADRESSE 2", "min-w-[200px]"],
                      ["kg", "KG", ""],
                      ["reservations", "RÉSERVATIONS", ""],
                    ] as const
                  ).map(([key, label, thClass]) => (
                    <th
                      key={key}
                      className={`whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#10294B] ${thClass}`}
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
                  <th className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#10294B]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((r) => {
                  const tag = userSubscriptionTag(r.role, subscribedRoles);
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-slate-100 transition hover:bg-slate-50/80"
                    >
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-700">
                        {formatDateCourt(r.inscriptionDate)}
                      </td>
                      <td className="max-w-[220px] truncate px-4 py-3 font-medium text-slate-900">
                        {r.nomAffiche}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-slate-800">{r.role}</span>
                          <span
                            className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${subscriptionBadgeClass(tag)}`}
                          >
                            {subscriptionTagLabel(tag)}
                          </span>
                        </div>
                      </td>
                      <td className="max-w-[240px] truncate px-4 py-3 text-slate-600">
                        {r.email}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {r.telephone}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-700">
                        {r.codePostal}
                      </td>
                      <td className="max-w-[260px] px-4 py-3 text-slate-700">
                        <span className="line-clamp-2" title={r.adresse1}>
                          {r.adresse1}
                        </span>
                      </td>
                      <td className="max-w-[260px] px-4 py-3 text-slate-700">
                        <span className="line-clamp-2" title={r.adresse2}>
                          {r.adresse2}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-800">
                        {r.kgDisplay}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-800">
                        {r.reservations}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/admin/utilisateurs/${encodeURIComponent(r.id)}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#10294B]/25 bg-[#10294B]/[0.06] px-2.5 py-1.5 text-xs font-bold text-[#10294B] transition hover:bg-[#10294B]/10"
                          >
                            <svg
                              className="h-3.5 w-3.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                              />
                            </svg>
                            Modifier
                          </Link>
                          <button
                            type="button"
                            onClick={() => void handleDelete(r.id, r.nomAffiche)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#CE2029]/30 bg-white px-2.5 py-1.5 text-xs font-bold text-[#CE2029] transition hover:bg-[#CE2029]/[0.06]"
                          >
                            <svg
                              className="h-3.5 w-3.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                            Supprimer
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
