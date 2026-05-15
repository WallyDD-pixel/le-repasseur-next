"use client";

import {
  formatHeureReservation,
  formatReservationCreneau,
  reservationEtatBadgeClass,
  type ReservationAdminRow,
} from "@/lib/reservationsAdmin";

type Props = {
  rows: ReservationAdminRow[];
  loading?: boolean;
  error?: string | null;
};

export function ClientReservationsTable({ rows, loading, error }: Props) {
  return (
    <section
      className="rounded-2xl border border-slate-200/70 bg-white/85 p-5 shadow-sm sm:p-6"
      aria-labelledby="my-reservations"
    >
      <h2
        id="my-reservations"
        className="font-lobster text-2xl text-[#10294B]"
      >
        Mes demandes de réservation
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Les créneaux que vous avez réservés via l&apos;application mobile.
      </p>

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Chargement de vos demandes…</p>
      ) : error ? (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          Aucune demande pour le moment. Réservez un créneau depuis l&apos;application
          Le Repasseur.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200/80">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-slate-600">
                <th className="whitespace-nowrap px-4 py-2.5 font-semibold">
                  Date de demande
                </th>
                <th className="whitespace-nowrap px-4 py-2.5 font-semibold">
                  Collecte
                </th>
                <th className="whitespace-nowrap px-4 py-2.5 font-semibold">
                  Retour
                </th>
                <th className="px-4 py-2.5 font-semibold">Kg</th>
                <th className="px-4 py-2.5 font-semibold">État</th>
                <th className="hidden px-4 py-2.5 font-semibold sm:table-cell">
                  N° commande
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                    {formatHeureReservation(r.heureReservation)}
                  </td>
                  <td className="min-w-[10rem] px-4 py-3 text-slate-700">
                    {formatReservationCreneau(
                      r.dateReservation,
                      r.dateReservationDisplay
                    )}
                  </td>
                  <td className="min-w-[10rem] px-4 py-3 text-slate-700">
                    {formatReservationCreneau(
                      r.dateRetour,
                      r.dateRetourDisplay
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                    {r.kgDisplay}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${reservationEtatBadgeClass(r.etat)}`}
                    >
                      {r.etat}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 font-mono text-xs text-slate-600 sm:table-cell">
                    {r.numeroCommande !== "—" ? r.numeroCommande : "—"}
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
