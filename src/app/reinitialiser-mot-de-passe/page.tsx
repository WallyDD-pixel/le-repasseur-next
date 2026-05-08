"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  verifyPasswordResetCode,
  confirmPasswordReset,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { PageShell } from "@/components/shell/PageShell";
import { Input, Label, PrimaryButton } from "@/components/ui/FormField";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode");
  const oobCode = searchParams.get("oobCode");

  const [emailPreview, setEmailPreview] = useState<string | null>(null);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (mode !== "resetPassword" || !oobCode) {
      setError("Lien invalide ou expiré. Demandez un nouvel e-mail depuis la page « Mot de passe oublié ».");
      setChecking(false);
      return;
    }
    const auth = getFirebaseAuth();
    verifyPasswordResetCode(auth, oobCode)
      .then((email) => {
        setEmailPreview(email);
        setChecking(false);
      })
      .catch(() => {
        setError("Lien invalide ou expiré.");
        setChecking(false);
      });
  }, [mode, oobCode]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!oobCode) return;
    if (pw1 !== pw2) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    if (pw1.length < 6) {
      setError("Au moins 6 caractères.");
      return;
    }
    try {
      const auth = getFirebaseAuth();
      await confirmPasswordReset(auth, oobCode, pw1);
      try {
        localStorage.removeItem("userPassword");
        localStorage.removeItem("rememberMe");
      } catch {
        /* ignore */
      }
      setSuccess(true);
      setTimeout(() => {
        window.location.href = "/connexion?reset=ok";
      }, 1500);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as Error).message)
          : "Échec de la réinitialisation.";
      setError(msg);
    }
  }

  if (checking) {
    return (
      <PageShell
        title="Réinitialisation"
        subtitle="Vérification de votre lien sécurisé…"
      >
        <p className="py-10 text-center text-slate-500">Patientez…</p>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Nouveau mot de passe"
      subtitle={
        emailPreview
          ? `Compte : ${emailPreview}`
          : "Choisissez un mot de passe sécurisé."
      }
    >
      {success ? (
        <p className="rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-4 text-center text-emerald-900">
          Mot de passe enregistré. Redirection vers la connexion…
        </p>
      ) : error && !emailPreview ? (
        <p className="rounded-xl border border-red-200/80 bg-red-50/90 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="pw1">Nouveau mot de passe</Label>
            <Input
              id="pw1"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={pw1}
              onChange={(e) => setPw1(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="pw2">Confirmer</Label>
            <Input
              id="pw2"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
            />
          </div>
          {error && emailPreview ? (
            <p className="text-sm font-semibold text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          <PrimaryButton type="submit">Enregistrer</PrimaryButton>
        </form>
      )}

      <p className="mt-8 text-center text-sm">
        <Link href="/connexion" className="font-medium text-[#CE2029] hover:underline">
          Retour à la connexion
        </Link>
      </p>
    </PageShell>
  );
}

export default function ReinitialiserMotDePassePage() {
  return (
    <Suspense
      fallback={
        <PageShell title="Réinitialisation" subtitle="Chargement…">
          <p className="py-10 text-center text-slate-500">Patientez…</p>
        </PageShell>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
