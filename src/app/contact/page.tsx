import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "@/components/contact/ContactForm";
import { PageShell } from "@/components/shell/PageShell";

export const metadata: Metadata = {
  title: "Contactez-nous",
};

export default function ContactPage() {
  return (
    <PageShell
      title="Contactez-nous"
      maxWidth="md"
    >
      <div className="space-y-8">
        <ContactForm />

        <p className="border-t border-slate-200/80 pt-6 text-center text-sm">
          Une question ? Contactez Le Repasseur au{" "}
          <a
            href="tel:+33767123639"
            className="font-semibold text-[#10294B] underline decoration-[#CE2029]/40 underline-offset-2 hover:text-[#CE2029]"
          >
            07 67 12 36 39
          </a>
        </p>

        <p className="text-center text-sm">
          <Link href="/" className="font-medium text-[#CE2029] hover:underline">
            ← Retour à l&apos;accueil
          </Link>
        </p>
      </div>
    </PageShell>
  );
}
