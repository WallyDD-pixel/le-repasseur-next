import type { Metadata } from "next";
import { PageShell } from "@/components/shell/PageShell";

export const metadata: Metadata = {
  title: "Conditions générales d’utilisation",
};

export default function CGUPage() {
  return (
    <PageShell
      title="CGU"
      subtitle="Conditions générales d’utilisation du site Le Repasseur."
      maxWidth="lg"
    >
      <article className="space-y-4 text-slate-600">
        <p className="leading-relaxed">
          Le contenu juridique détaillé de votre ancienne page{" "}
          <strong>CGU.html</strong> peut être copié ici ou importé depuis un
          fichier Markdown. Ce bloc est un emplacement pour la version Next.js
          du site.
        </p>
      </article>
    </PageShell>
  );
}
