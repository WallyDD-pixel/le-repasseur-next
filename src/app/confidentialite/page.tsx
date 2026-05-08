import type { Metadata } from "next";
import { PageShell } from "@/components/shell/PageShell";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
};

export default function ConfidentialitePage() {
  return (
    <PageShell
      title="Confidentialité"
      subtitle="Politique de confidentialité et protection des données."
      maxWidth="lg"
    >
      <article className="space-y-4 text-slate-600">
        <p className="leading-relaxed">
          Emplacement réservé : migrez le contenu depuis{" "}
          <strong>Confidential.html</strong> (RGPD, cookies, etc.).
        </p>
      </article>
    </PageShell>
  );
}
