"use client";

import { useState } from "react";
import type { ClientTransactionRow } from "@/lib/clientTransactions";

type Props = {
  rows: ClientTransactionRow[];
  formatDate: (d: Date | null) => string;
  onDownloadSiteInvoice?: (transactionId: string) => Promise<void>;
};

function InvoiceCell({
  row,
  onDownloadSiteInvoice,
}: {
  row: ClientTransactionRow;
  onDownloadSiteInvoice?: (transactionId: string) => Promise<void>;
}) {
  const [loadingPdf, setLoadingPdf] = useState(false);

  if (!onDownloadSiteInvoice) {
    return <span className="text-slate-400">—</span>;
  }

  return (
    <button
      type="button"
      disabled={loadingPdf}
      onClick={async () => {
        setLoadingPdf(true);
        try {
          await onDownloadSiteInvoice(row.id);
        } finally {
          setLoadingPdf(false);
        }
      }}
      className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-[#CE2029] to-[#c41e26] px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition hover:from-[#b91b24] hover:to-[#a91820] disabled:opacity-50"
    >
      {loadingPdf ? "Génération…" : "Télécharger PDF"}
    </button>
  );
}

export function ClientTransactionsHistory({
  rows,
  formatDate,
  onDownloadSiteInvoice,
}: Props) {
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
        Téléchargez vos factures au format PDF.
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
                <th className="px-4 py-2.5 font-semibold">Facture</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-700">
                    {formatDate(r.date)}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{r.type}</td>
                  <td className="px-4 py-2.5 text-slate-700">{r.titre}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-semibold text-[#10294B]">
                    {r.montantDisplay}
                  </td>
                  <td className="px-4 py-2.5">
                    <InvoiceCell
                      row={r}
                      onDownloadSiteInvoice={onDownloadSiteInvoice}
                    />
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
