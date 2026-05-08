"use client";

import { Suspense, useEffect, useState } from "react";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { PageShell } from "@/components/shell/PageShell";
import { getUserAccess } from "@/lib/authRedirect";
import { getFirebaseAuth } from "@/lib/firebase";

function GateInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [gate, setGate] = useState<"checking" | "allowed">("checking");

  const searchString = searchParams.toString();

  useEffect(() => {
    const auth = getFirebaseAuth();
    const q = searchString ? `?${searchString}` : "";
    const returnToPath = pathname + q;

    return onAuthStateChanged(auth, async (u) => {
      if (!u) {
        const redirect = encodeURIComponent(returnToPath);
        router.replace(`/connexion?redirect=${redirect}`);
        return;
      }

      const access = await getUserAccess(u.uid);
      if (!access.userExists) {
        router.replace("/compte");
        return;
      }

      const allowed =
        access.isAdmin ||
        access.isSubscribedClient ||
        access.isPendingSignup;

      if (!allowed) {
        router.replace("/compte");
        return;
      }

      setGate("allowed");
    });
  }, [router, pathname, searchString]);

  if (gate === "checking") {
    return (
      <PageShell
        title="Espace client"
        subtitle="Vérification de votre session…"
        maxWidth="sm"
        showShellHeading
        contentVariant="flush"
      >
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-4 py-8">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#10294B]/25 border-t-[#CE2029]" />
          <p className="text-center text-sm text-slate-600">
            Accès réservé aux comptes clients connectés.
          </p>
        </div>
      </PageShell>
    );
  }

  return <>{children}</>;
}

/**
 * Toute l’arborescence `/espace-client/*` exige une session Firebase et un profil
 * autorisé (abonné, inscription en cours ou admin).
 */
export function EspaceClientAuthGate({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <PageShell title="Espace client" subtitle="Chargement…" maxWidth="sm">
          <div className="flex min-h-[30vh] items-center justify-center py-10">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#10294B]/25 border-t-[#CE2029]" />
          </div>
        </PageShell>
      }
    >
      <GateInner>{children}</GateInner>
    </Suspense>
  );
}
