import type { Metadata } from "next";

import { LegalArticle } from "@/components/legal/LegalArticle";
import { PageShell } from "@/components/shell/PageShell";
import { PreparationContent } from "@/content/legal/preparationContent";

export const metadata: Metadata = {
  title: "Bien préparer sa collecte",
};

export default function PreparationPage() {
  return (
    <PageShell
      title="Bien préparer sa collecte"
      subtitle="Guide client pour la collecte de linge à domicile."
      maxWidth="lg"
    >
      <LegalArticle>
        <PreparationContent />
      </LegalArticle>
    </PageShell>
  );
}
