import type { Metadata } from "next";

import { LegalArticle } from "@/components/legal/LegalArticle";
import { PageShell } from "@/components/shell/PageShell";
import { CgvContent } from "@/content/legal/cgvContent";

export const metadata: Metadata = {
  title: "Conditions générales de vente",
};

export default function CGVPage() {
  return (
    <PageShell
      title="CGV"
      subtitle="Conditions générales de vente — collecte et repassage à domicile."
      maxWidth="lg"
    >
      <LegalArticle>
        <CgvContent />
      </LegalArticle>
    </PageShell>
  );
}
