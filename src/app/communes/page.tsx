import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/shell/PageShell";
import { COVERED_COMMUNES } from "@/lib/coveredPostalCodes";

export const metadata: Metadata = {
  title: "Communes couvertes",
};

export default function CommunesPage() {
  return (
    <PageShell
      title="Liste des communes couvertes"
      subtitle="Notre secteur s’agrandit de jour en jour. Voici les codes postaux actuellement desservis."
      maxWidth="lg"
    >
      <p className="mb-6 leading-relaxed text-slate-700">
        Si votre commune ne fait pas partie de la liste, vous pouvez tout de même{" "}
        <Link href="/inscription" className="font-semibold text-[#CE2029] hover:underline">
          créer un compte
        </Link>{" "}
        : nous vous préviendrons dès que le service sera disponible chez vous.
      </p>

      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#10294B] text-white">
            <tr>
              <th className="px-4 py-3 font-semibold">Code(s) postal(aux)</th>
              <th className="px-4 py-3 font-semibold">Commune</th>
            </tr>
          </thead>
          <tbody>
            {COVERED_COMMUNES.map((row) => (
              <tr
                key={row.city}
                className="border-t border-slate-100 odd:bg-white even:bg-slate-50"
              >
                <td className="px-4 py-3 font-medium text-[#10294B]">
                  {row.postalCodes.join(", ")}
                </td>
                <td className="px-4 py-3 text-slate-800">{row.city}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-8 text-center">
        <Link
          href="/inscription"
          className="font-semibold text-[#10294B] hover:text-[#CE2029] hover:underline"
        >
          ← Retour à l’inscription
        </Link>
      </p>
    </PageShell>
  );
}
