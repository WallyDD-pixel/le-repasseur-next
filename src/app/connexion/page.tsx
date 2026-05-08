"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { resolvePostLoginHref } from "@/lib/authRedirect";
import { safeEspaceClientRedirectPath } from "@/lib/safeInternalRedirect";
import { PageShell } from "@/components/shell/PageShell";
import { Input, Label, PrimaryButton } from "@/components/ui/FormField";

function ConnexionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resetOk = searchParams.get("reset") === "ok";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const auth = getFirebaseAuth();
      const cred = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
      const back = safeEspaceClientRedirectPath(searchParams.get("redirect"));
      if (back) {
        router.push(back);
        return;
      }
      const { href, external, error: roleErr } = await resolvePostLoginHref(
        cred.user.uid
      );
      if (roleErr) setError(roleErr);
      if (external) {
        window.location.href = href;
        return;
      }
      router.push(href);
    } catch (err: unknown) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code: string }).code)
          : "";
      if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
        setError("E-mail ou mot de passe incorrect.");
      } else if (code === "auth/user-not-found") {
        setError("Aucun compte avec cet e-mail.");
      } else if (code === "auth/user-disabled") {
        setError("Ce compte est désactivé.");
      } else {
        setError("Connexion impossible. Vérifiez vos identifiants.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell
      title="Se connecter"
      subtitle="Accédez à votre espace client Le Repasseur."
    >
      {resetOk ? (
        <p className="mb-6 rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-900">
          Mot de passe mis à jour. Connectez-vous avec votre nouveau mot de
          passe.
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="password">Mot de passe</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error ? (
          <p className="text-sm font-semibold text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <PrimaryButton type="submit" loading={loading}>
          Se connecter
        </PrimaryButton>
      </form>

      <div className="mt-8 space-y-3 border-t border-slate-200/80 pt-6 text-center text-sm">
        <Link
          href="/mot-de-passe-oublie"
          className="block font-medium text-[#CE2029] hover:underline"
        >
          Mot de passe oublié ?
        </Link>
        <p className="text-slate-600">
          Pas encore de compte ?{" "}
          <Link href="/inscription" className="font-semibold text-[#10294B] hover:underline">
            Créer un compte
          </Link>
        </p>
      </div>
    </PageShell>
  );
}

export default function ConnexionPage() {
  return (
    <Suspense
      fallback={
        <div className="py-32 text-center text-slate-500">Chargement…</div>
      }
    >
      <ConnexionForm />
    </Suspense>
  );
}
