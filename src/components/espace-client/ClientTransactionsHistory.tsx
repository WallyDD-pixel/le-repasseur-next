"use client";

export type ClientTransactionRow = {
  id: string;
  date: Date | null;
  type: string;
  titre: string;
  montantDisplay: string;
};

type Props = {
  rows: ClientTransactionRow[];
  formatDate: (d: Date | null) => string;
};

export function ClientTransactionsHistory({ rows, formatDate }: Props) {
  return (
    <section
      className="rounded-2xl border border-slate-200/70 bg-white/85 p-5 shadow-sm sm:p-6"
      aria-labelledby="tx-history"
    >
      <h2
        id="tx-history"
        className="font-lobster text-2xl text-[#10294B]"
      >
        Historique des transactions
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Vos paiements, abonnements et renouvellements.
      </p>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          Aucune transaction pour le moment.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200/80">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-slate-600">
                <th className="px-4 py-2.5 font-semibold">Date</th>
                <th className="px-4 py-2.5 font-semibold">Type</th>
                <th className="px-4 py-2.5 font-semibold">Détail</th>
                <th className="px-4 py-2.5 font-semibold">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2.5 text-slate-700">
                    {formatDate(r.date)}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{r.type}</td>
                  <td className="px-4 py-2.5 text-slate-700">{r.titre}</td>
                  <td className="px-4 py-2.5 font-semibold text-[#10294B]">
                    {r.montantDisplay}
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
