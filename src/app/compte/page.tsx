"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseFirestore } from "@/lib/firebase";
import { getUserAccess } from "@/lib/authRedirect";
import { PageShell } from "@/components/shell/PageShell";

export default function ComptePage() {
  const [user, setUser] = useState<{
    email: string | null;
    role?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [access, setAccess] = useState<Awaited<
    ReturnType<typeof getUserAccess>
  > | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        setAccess(null);
        setLoading(false);
        return;
      }
      const db = getFirebaseFirestore();
      const snap = await getDoc(doc(db, "users", u.uid));
      const role = snap.exists() ? (snap.data().role as string) : undefined;
      setUser({ email: u.email, role });
      const a = await getUserAccess(u.uid);
      setAccess(a);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <PageShell title="Mon espace" subtitle="Chargement de votre profil…">
        <p className="py-10 text-center text-slate-500">Patientez…</p>
      </PageShell>
    );
  }

  if (!user) {
    return (
      <PageShell
        title="Mon espace"
        subtitle="Connectez-vous pour accéder à votre tableau de bord."
      >
        <p className="text-center text-slate-600">
          Vous n&apos;êtes pas connecté.
        </p>
        <Link
          href="/connexion"
          className="mt-8 block w-full rounded-xl bg-[#CE2029] py-3.5 text-center text-base font-bold text-white shadow-lg shadow-[#CE2029]/20 transition hover:bg-[#b91b24]"
        >
          Se connecter
        </Link>
      </PageShell>
    );
  }

  const primaryHref = access?.isAdmin
    ? "/admin"
    : access?.isSubscribedClient || access?.isPendingSignup
      ? "/espace-client"
      : null;

  const primaryLabel = access?.isAdmin
    ? "Administration"
    : access?.isSubscribedClient || access?.isPendingSignup
      ? "Mon espace client"
      : null;

  return (
    <PageShell
      title="Mon compte"
      subtitle="Profil et statut de votre accès Le Repasseur."
      maxWidth="md"
    >
      <div className="space-y-6">
        {primaryHref && primaryLabel ? (
          <Link
            href={primaryHref}
            className="block w-full rounded-xl bg-[#CE2029] py-3.5 text-center text-base font-bold text-white shadow-lg shadow-[#CE2029]/20 transition hover:bg-[#b91b24]"
          >
            {primaryLabel}
          </Link>
        ) : null}

        <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-wider text-[#CE2029]">
            E-mail
          </p>
          <p className="mt-1 text-lg font-semibold text-[#10294B]">
            {user.email}
          </p>
        </div>
        {user.role ? (
          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[#CE2029]">
              Offre / rôle
            </p>
            <p className="mt-1 text-lg font-semibold text-[#10294B]">
              {user.role}
            </p>
          </div>
        ) : null}

        {access && !access.userExists ? (
          <p className="text-sm text-red-600">
            Profil introuvable dans la base. Contactez le support.
          </p>
        ) : null}
        {access?.unknownRoleError ? (
          <p className="text-sm text-amber-800">{access.unknownRoleError}</p>
        ) : null}

        <p className="text-sm leading-relaxed text-slate-600">
          Les réservations détaillées et l&apos;historique des paiements
          s&apos;affichent progressivement ici et dans l&apos;application.
        </p>
        <button
          type="button"
          onClick={() => signOut(getFirebaseAuth())}
          className="w-full rounded-xl border-2 border-[#10294B]/15 py-3 text-sm font-semibold text-[#10294B] transition hover:bg-[#10294B]/5"
        >
          Se déconnecter
        </button>
      </div>
    </PageShell>
  );
}
