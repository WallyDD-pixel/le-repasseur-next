"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PageShell } from "@/components/shell/PageShell";
import { getFirebaseAuth } from "@/lib/firebase";
import { requestStripeCheckoutSession } from "@/lib/checkoutClient";
import {
  getCatalogEntryByRecapPlanId,
  type ClientCatalogEntry,
} from "@/lib/clientCatalog";
import { isSubscriptionRecapPlan } from "@/lib/stripePlans";
import {
  loadHomeFirestoreImages,
  type HomeFirestoreImages,
} from "@/lib/homeFirestoreImages";

function PlanRecapCard({
  entry,
  imageUrl,
}: {
  entry: ClientCatalogEntry;
  imageUrl?: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="grid gap-6 p-6 sm:grid-cols-[minmax(0,200px)_1fr] sm:gap-8 sm:p-8">
        <div className="relative mx-auto aspect-[4/3] w-full max-w-[280px] overflow-hidden rounded-xl border-2 border-[#10294B] shadow-[inset_0_0_0_1px_rgba(206,32,41,0.35)] sm:mx-0">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt=""
              className="h-full w-full object-cover object-top"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-slate-100">
              <span className="text-xs font-medium text-slate-400">
                Visuel formule
              </span>
            </div>
          )}
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
            {entry.primaryCta === "Commander" ? "Collecte ponctuelle" : "Abonnement"}
          </p>
          <h2 className="mt-1 font-lobster text-3xl text-[#CE2029] sm:text-4xl">
            {entry.name}
          </h2>
          <p className="mt-3 text-2xl font-bold tracking-tight text-[#10294B]">
            {entry.priceLine}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {entry.detailLine}
          </p>
          <ul className="mt-5 space-y-2 border-t border-slate-100 pt-5 text-sm leading-relaxed text-slate-700">
            {entry.bullets.map((line, i) => (
              <li key={`${entry.recapPlanId}-${i}`} className="flex gap-2">
                <span className="font-bold text-[#CE2029]" aria-hidden>
                  ·
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function NextSteps({ entry }: { entry: ClientCatalogEntry }) {
  const sub = isSubscriptionRecapPlan(entry.recapPlanId);
  return (
    <section
      aria-labelledby="next-steps"
      className="rounded-2xl border border-[#10294B]/10 bg-[#10294B]/[0.03] px-5 py-5 sm:px-7 sm:py-6"
    >
      <h3
        id="next-steps"
        className="text-lg font-bold tracking-tight text-[#10294B]"
      >
        Ce qui se passe ensuite
      </h3>
      <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-slate-700">
        <li>
          En cliquant sur « Payer sur Stripe », vous êtes redirigé vers une page
          de paiement <strong>hébergée par Stripe</strong> (carte bancaire,
          environnement sécurisé).
        </li>
        {sub ? (
          <>
            <li>
              Vous souscrivez un <strong>prélèvement mensuel</strong> correspondant
              à cette formule. Sans engagement au-delà du cadre indiqué sur nos CGV.
            </li>
            <li>
              Après validation du paiement, <strong>l&apos;équipe active votre accès</strong>{" "}
              sous réserve de disponibilité ; vous pourrez réserver vos collectes dans
              l&apos;application mobile.
            </li>
          </>
        ) : (
          <>
            <li>
              Vous réglez un <strong>paiement unique</strong> pour cette collecte
              ponctuelle (montant affiché ci-dessus).
            </li>
            <li>
              Après paiement, la prestation suit le même déroulé que pour les
              abonnés : créneaux et suivi dans l&apos;application.
            </li>
          </>
        )}
      </ol>
      <p className="mt-4 text-xs leading-relaxed text-slate-500">
        En poursuivant, vous reconnaissez avoir pris connaissance de nos{" "}
        <Link href="/cgv" className="font-semibold text-[#10294B] underline">
          conditions générales de vente
        </Link>
        .
      </p>
    </section>
  );
}

function RecapContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planRaw = searchParams.get("plan");
  const checkoutNotice = searchParams.get("checkout");

  const [images, setImages] = useState<HomeFirestoreImages>({});
  const [payPending, setPayPending] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  useEffect(() => {
    loadHomeFirestoreImages().then(setImages);
  }, []);

  const entry = planRaw
    ? getCatalogEntryByRecapPlanId(planRaw)
    : undefined;

  useEffect(() => {
    if (checkoutNotice === "cancel") {
      setPayError(null);
    }
  }, [checkoutNotice]);

  if (!planRaw?.trim()) {
    return (
      <PageShell
        title="Récapitulatif"
        subtitle="Aucune formule sélectionnée."
        maxWidth="xl"
        showShellHeading
        contentVariant="flush"
      >
        <p className="text-center text-slate-600">
          Choisissez une offre depuis l&apos;espace client.
        </p>
        <div className="mt-8 flex justify-center">
          <Link
            href="/espace-client"
            className="rounded-xl bg-[#10294B] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#10294B]/90"
          >
            Retour à l&apos;espace client
          </Link>
        </div>
      </PageShell>
    );
  }

  if (!entry) {
    return (
      <PageShell
        title="Récapitulatif"
        subtitle="Cette offre n&apos;existe pas ou n&apos;est plus disponible."
        maxWidth="xl"
        showShellHeading
        contentVariant="flush"
      >
        <div className="flex justify-center">
          <Link
            href="/espace-client"
            className="rounded-xl border-2 border-[#10294B]/25 px-6 py-3 text-sm font-bold text-[#10294B] transition hover:bg-[#10294B]/5"
          >
            Retour à l&apos;espace client
          </Link>
        </div>
      </PageShell>
    );
  }

  const planId = entry.recapPlanId;

  async function onPay() {
    setPayError(null);
    setPayPending(true);
    let idToken: string | undefined;
    const u = getFirebaseAuth().currentUser;
    if (u) {
      try {
        idToken = await u.getIdToken();
      } catch {
        /* paiement possible sans jeton ; Stripe demandera l’e-mail */
      }
    }
    const result = await requestStripeCheckoutSession(planId, { idToken });
    setPayPending(false);
    if (!result.ok) {
      setPayError(result.error);
      return;
    }
    window.location.assign(result.redirectUrl);
  }

  const primaryLabel = "Payer sur Stripe";

  return (
    <PageShell
      title="Récapitulatif avant paiement"
      subtitle="Vérifiez la formule choisie, puis poursuivez vers le paiement sécurisé."
      maxWidth="xl"
      showShellHeading
      contentVariant="flush"
    >
      <div className="space-y-8">
        {checkoutNotice === "cancel" ? (
          <p
            className="rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-center text-sm text-amber-950"
            role="status"
          >
            Paiement annulé. Vous pouvez réessayer quand vous voulez.
          </p>
        ) : null}

        <PlanRecapCard entry={entry} imageUrl={images[entry.imageKey]} />

        <NextSteps entry={entry} />

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => router.push("/espace-client")}
            className="order-2 rounded-xl border-2 border-[#10294B]/20 px-6 py-3.5 text-center text-sm font-bold text-[#10294B] transition hover:bg-[#10294B]/5 sm:order-1"
          >
            Modifier mon choix
          </button>
          <button
            type="button"
            onClick={onPay}
            disabled={payPending}
            className="order-1 inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#CE2029] to-[#c41e26] px-8 text-center text-sm font-bold text-white shadow-lg shadow-[#CE2029]/25 transition hover:from-[#b91b24] hover:to-[#a91820] disabled:cursor-wait disabled:opacity-85 sm:order-2 sm:max-w-md sm:flex-none"
          >
            {payPending ? "Connexion à Stripe…" : primaryLabel}
            <span aria-hidden>→</span>
          </button>
        </div>

        {payError ? (
          <p className="text-center text-sm text-red-600" role="alert">
            {payError}
          </p>
        ) : null}

        <p className="text-center text-xs text-slate-500">
          Cartes acceptées via Stripe · Le montant affiché est celui transmis à Stripe
          selon votre configuration des prix.
        </p>
      </div>
    </PageShell>
  );
}

function RecapFallback() {
  return (
    <PageShell
      title="Récapitulatif"
      subtitle="Chargement…"
      maxWidth="xl"
      showShellHeading
      contentVariant="flush"
    >
      <p className="py-10 text-center text-slate-500">Patientez…</p>
    </PageShell>
  );
}

export default function EspaceClientRecapPage() {
  return (
    <Suspense fallback={<RecapFallback />}>
      <RecapContent />
    </Suspense>
  );
}
