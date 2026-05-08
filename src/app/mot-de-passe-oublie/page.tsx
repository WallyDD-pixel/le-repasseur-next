"use client";

import { useState } from "react";
import Link from "next/link";
import { sendPasswordResetEmail } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { PageShell } from "@/components/shell/PageShell";
import { Input, Label, PrimaryButton } from "@/components/ui/FormField";

function getContinueUrl(): string {
  if (typeof window === "undefined") return "https://www.le-repasseur.fr";
  const h = window.location.hostname;
  if (h === "localhost" || h === "127.0.0.1") {
    return `${window.location.origin}/connexion`;
  }
  return "https://www.le-repasseur.fr/connexion";
}

export default function MotDePasseOubliePage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setLoading(true);
    try {
      const auth = getFirebaseAuth();
      await sendPasswordResetEmail(auth, email.trim(), {
        url: getContinueUrl(),
        handleCodeInApp: false,
      });
      setMessage(
        "E-mail envoyé. Ouvrez-le et cliquez sur le lien pour choisir un nouveau mot de passe. " +
          "Vérifiez aussi que votre domaine est bien autorisé dans Firebase (domaines autorisés)."
      );
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as Error).message)
          : "Une erreur est survenue.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell
      title="Mot de passe oublié"
      subtitle="Nous vous enverrons un lien pour définir un nouveau mot de passe. Ce n’est pas un mot de passe dans le mail : tout se fait après le clic sur le lien."
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <Label htmlFor="email">Adresse e-mail</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@exemple.fr"
          />
        </div>
        {message ? (
          <p className="rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-900">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-xl border border-red-200/80 bg-red-50/90 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        ) : null}
        <PrimaryButton type="submit" loading={loading}>
          Envoyer le lien
        </PrimaryButton>
      </form>
      <p className="mt-8 text-center text-sm">
        <Link href="/connexion" className="font-medium text-[#CE2029] hover:underline">
          Retour à la connexion
        </Link>
      </p>
    </PageShell>
  );
}
