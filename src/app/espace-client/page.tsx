"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { EspaceClientAccountFooter } from "@/components/espace-client/EspaceClientAccountFooter";
import { ClientProductCatalog } from "@/components/espace-client/ClientProductCatalog";
import { EspaceClientStatusPanel } from "@/components/espace-client/EspaceClientStatusPanel";
import { PartnerCodeForm } from "@/components/espace-client/PartnerCodeForm";
import { getFirebaseAuth, getFirebaseFirestore } from "@/lib/firebase";
import { getUserAccess, type UserAccessResult } from "@/lib/authRedirect";
import { siteAsset } from "@/lib/assetBase";
import { PageShell } from "@/components/shell/PageShell";

function AppStoreBadgeRow() {
  return (
    <div className="rounded-2xl border border-slate-200/50 bg-white/70 px-5 py-5 shadow-sm backdrop-blur-sm sm:px-6 lg:inline-block lg:max-w-none lg:px-8 lg:py-6">
      <p className="mb-1 text-center text-sm font-bold text-[#10294B] lg:text-left">
        Accéder à l&apos;application
      </p>
      <p className="mb-4 text-center text-xs text-slate-500 lg:text-left">
        Réservez vos créneaux de collecte en quelques clics
      </p>
      <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-10 lg:justify-start">
        <a
          href="https://play.google.com/store/apps/details?id=com.repasseur.repasseur&gl=FR"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block leading-none transition hover:opacity-90"
        >
          <Image
            src={siteAsset("/assets/imgg/pngegg.png")}
            alt="Télécharger sur Google Play"
            width={150}
            height={50}
            className="h-auto w-[150px]"
            unoptimized
          />
        </a>
        <a
          href="https://apps.apple.com/us/app/le-repasseur/id6670428906"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block leading-none transition hover:opacity-90"
        >
          <Image
            src={siteAsset("/assets/imgg/pngegg (1).png")}
            alt="Télécharger sur l'App Store"
            width={150}
            height={50}
            className="h-auto w-[150px]"
            unoptimized
          />
        </a>
      </div>
    </div>
  );
}

function formatFirstName(
  prenom: string | undefined,
  email: string | null
): string {
  const p = prenom?.trim();
  if (p) {
    return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
  }
  if (email) {
    const local = email.split("@")[0] ?? "vous";
    return local.charAt(0).toUpperCase() + local.slice(1);
  }
  return "vous";
}

export default function EspaceClientPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [prenom, setPrenom] = useState<string | undefined>();
  const [access, setAccess] = useState<UserAccessResult | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      setEmail(u.email);
      const db = getFirebaseFirestore();
      const [a, userSnap] = await Promise.all([
        getUserAccess(u.uid),
        getDoc(doc(db, "users", u.uid)),
      ]);
      if (userSnap.exists()) {
        const pr = userSnap.data().prenom;
        if (typeof pr === "string") setPrenom(pr);
      }
      if (a.isAdmin) {
        router.replace("/admin");
        return;
      }
      setAccess(a);
      setReady(true);
    });
  }, [router]);

  if (!ready || !access) {
    return (
      <PageShell title="Mon espace" subtitle="Chargement…">
        <p className="py-10 text-center text-slate-500">Patientez…</p>
      </PageShell>
    );
  }

  const subscribed = access.isSubscribedClient;
  const firstName = formatFirstName(prenom, email);
  const subscriptionDisplay = subscribed
    ? (access.role ?? "Abonné").toUpperCase()
    : "AUCUN";

  return (
    <PageShell
      title="Espace client"
      maxWidth="xl"
      showShellHeading={false}
      contentVariant="flush"
    >
      <div className="space-y-8 lg:space-y-10">
        <h1 className="sr-only">Espace client Le Repasseur</h1>

        <EspaceClientStatusPanel
          firstName={firstName}
          subscriptionDisplay={subscriptionDisplay}
          collectesDisplay={subscribed ? "—" : "0"}
          poidsDisplay={subscribed ? "—" : "0 kg"}
          subscribedHint={subscribed}
        />

        <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-start lg:gap-12 xl:gap-16">
          <AppStoreBadgeRow />
          <PartnerCodeForm />
        </div>

        {subscribed ? (
          <div className="flex gap-4 rounded-2xl border-l-4 border-[#CE2029] bg-gradient-to-r from-[#CE2029]/[0.08] to-transparent px-5 py-4 lg:max-w-4xl">
            <p className="text-sm leading-relaxed text-[#10294B]">
              <span className="font-bold text-[#CE2029]">Abonné :</span> vos
              collectes et votre quota se suivent dans l&apos;application.
              Ci-dessous : packs ponctuels ou changement de formule.
            </p>
          </div>
        ) : null}

        <ClientProductCatalog />

        <EspaceClientAccountFooter />

        <div className="flex flex-col items-center gap-4 border-t border-slate-200/50 pt-8 lg:flex-row lg:flex-wrap lg:justify-center lg:gap-x-12 lg:pt-10">
          <Link
            href="/"
            className="text-sm font-semibold text-[#10294B] underline decoration-[#CE2029]/30 underline-offset-4 transition hover:decoration-[#CE2029]"
          >
            Accueil du site
          </Link>
          <Link
            href="/compte"
            className="text-sm font-semibold text-[#10294B] underline decoration-[#CE2029]/30 underline-offset-4 transition hover:decoration-[#CE2029]"
          >
            Mon compte
          </Link>
          <Link
            href="/contact"
            className="text-sm font-semibold text-[#10294B] underline decoration-[#CE2029]/30 underline-offset-4 transition hover:decoration-[#CE2029]"
          >
            Contact
          </Link>
        </div>

        <button
          type="button"
          onClick={() => signOut(getFirebaseAuth())}
          className="w-full rounded-xl border-2 border-[#10294B]/20 bg-white/80 py-3.5 text-sm font-bold text-[#10294B] shadow-sm transition hover:border-[#10294B]/35 hover:bg-[#10294B]/5 lg:mx-auto lg:max-w-xs"
        >
          Se déconnecter
        </button>
      </div>
    </PageShell>
  );
}
