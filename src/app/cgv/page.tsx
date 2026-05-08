import type { Metadata } from "next";
import { PageShell } from "@/components/shell/PageShell";

export const metadata: Metadata = {
  title: "Conditions générales de vente",
};

export default function CGVPage() {
  return (
    <PageShell
      title="CGV"
      subtitle="Conditions générales de vente."
      maxWidth="lg"
    >
      <article className="space-y-4 text-slate-600">
        <p className="leading-relaxed">
          Emplacement réservé : migrez le texte depuis{" "}
          <strong>CGV.html</strong> vers cette page ou vers un CMS.
        </p>
      </article>
    </PageShell>
  );
}
