import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/shell/PageShell";

export const metadata: Metadata = {
  title: "Bienvenue",
};

export default function InvitePage() {
  return (
    <PageShell
      title="Bienvenue !"
      subtitle="Votre compte est créé. Activez une offre ou contactez-nous pour profiter de toutes les fonctionnalités."
      maxWidth="md"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
        <a
          href="https://www.le-repasseur.fr/pricing/"
          className="block w-full rounded-xl bg-[#CE2029] py-3.5 text-center text-base font-bold text-white shadow-lg shadow-[#CE2029]/20 transition hover:bg-[#b91b24] sm:w-auto sm:min-w-[200px] sm:px-8"
        >
          Voir les offres
        </a>
        <Link
          href="/contact"
          className="block w-full rounded-xl border-2 border-[#10294B]/15 py-3.5 text-center text-base font-semibold text-[#10294B] transition hover:border-[#10294B]/30 hover:bg-[#10294B]/5 sm:w-auto sm:min-w-[200px] sm:px-8"
        >
          Contact
        </Link>
      </div>
    </PageShell>
  );
}
