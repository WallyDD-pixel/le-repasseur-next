"use client";

import { useCallback, useEffect, useState } from "react";
import {
  collection,
  getDocs,
  limit,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import {
  USER_QUOTA_AUDIT_COLLECTION,
  type UserQuotaAuditAction,
  type UserQuotaAuditSource,
} from "@/lib/userQuotaAudit";
import { getFirebaseFirestore } from "@/lib/firebase";
import { firebaseMessage } from "@/lib/firebaseError";

type AuditRow = {
  id: string;
  date: Date | null;
  source: UserQuotaAuditSource;
  action: UserQuotaAuditAction;
  beforeCollectes: number;
  beforeReservations: number;
  afterCollectes: number;
  afterReservations: number;
  deltaCollectes?: number;
  deltaReservations?: number;
  planId?: string;
  note?: string;
};

function toDate(raw: unknown): Date | null {
  if (raw instanceof Timestamp) return raw.toDate();
  return null;
}

function fmt(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sourceLabel(s: UserQuotaAuditSource): string {
  const map: Record<UserQuotaAuditSource, string> = {
    stripe_checkout: "Paiement (checkout)",
    stripe_webhook_renewal: "Renouvellement Stripe",
    admin_manual: "Admin",
    sync_stripe: "Sync Stripe",
    inscription: "Inscription",
    migration: "Migration",
  };
  return map[s] ?? s;
}

export function UserQuotaAuditPanel({ userId }: { userId: string }) {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const db = getFirebaseFirestore();
      const snap = await getDocs(
        query(
          collection(db, USER_QUOTA_AUDIT_COLLECTION),
          where("userId", "==", userId),
          limit(100)
        )
      );
      const parsed: AuditRow[] = snap.docs.map((d) => {
        const x = d.data();
        const before = (x.before ?? {}) as Record<string, unknown>;
        const after = (x.after ?? {}) as Record<string, unknown>;
        const delta = (x.delta ?? {}) as Record<string, unknown>;
        return {
          id: d.id,
          date: toDate(x.createdAt),
          source: (x.source as UserQuotaAuditSource) ?? "admin_manual",
          action: (x.action as UserQuotaAuditAction) ?? "set",
          beforeCollectes: Number(before.collectesKg ?? 0),
          beforeReservations: Number(before.reservations ?? 0),
          afterCollectes: Number(after.collectesKg ?? 0),
          afterReservations: Number(after.reservations ?? 0),
          deltaCollectes:
            delta.collectesKg != null ? Number(delta.collectesKg) : undefined,
          deltaReservations:
            delta.reservations != null
              ? Number(delta.reservations)
              : undefined,
          planId: typeof x.planId === "string" ? x.planId : undefined,
          note: typeof x.note === "string" ? x.note : undefined,
        };
      });
      parsed.sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
      setRows(parsed);
    } catch (err) {
      setError(firebaseMessage(err));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="mt-10 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#10294B]">
          Journal quotas (kg / collectes)
        </h2>
        <button
          type="button"
          onClick={() => void load()}
          className="text-xs font-semibold text-[#CE2029] hover:underline"
        >
          Actualiser
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Chargement…</p>
      ) : error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">
          Aucune entrée pour l&apos;instant. Les prochains changements
          (paiement, renouvellement, admin) seront enregistrés ici.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="px-2 py-2">Date</th>
                <th className="px-2 py-2">Source</th>
                <th className="px-2 py-2">Avant</th>
                <th className="px-2 py-2">Après</th>
                <th className="px-2 py-2">Δ</th>
                <th className="px-2 py-2">Détail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="whitespace-nowrap px-2 py-2">{fmt(r.date)}</td>
                  <td className="px-2 py-2">{sourceLabel(r.source)}</td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {r.beforeReservations} coll. · {r.beforeCollectes} kg
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {r.afterReservations} coll. · {r.afterCollectes} kg
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap text-emerald-800">
                    {r.deltaReservations != null
                      ? `${r.deltaReservations >= 0 ? "+" : ""}${r.deltaReservations} coll.`
                      : "—"}
                    {r.deltaCollectes != null
                      ? ` · ${r.deltaCollectes >= 0 ? "+" : ""}${r.deltaCollectes} kg`
                      : ""}
                  </td>
                  <td className="px-2 py-2 text-slate-600">
                    {[r.planId, r.note].filter(Boolean).join(" — ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
