import type { Metadata } from "next";

import { LegalArticle } from "@/components/legal/LegalArticle";
import { PageShell } from "@/components/shell/PageShell";
import { ConfidentialiteContent } from "@/content/legal/confidentialiteContent";

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
      <LegalArticle>
        <ConfidentialiteContent />
      </LegalArticle>
    </PageShell>
  );
}
