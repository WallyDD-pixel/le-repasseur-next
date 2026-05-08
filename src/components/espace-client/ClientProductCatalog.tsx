"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import {
  CLIENT_PACK_ITEMS,
  CLIENT_SUBSCRIPTION_ITEMS,
  type ClientCatalogEntry,
} from "@/lib/clientCatalog";
import {
  loadHomeFirestoreImages,
  type HomeFirestoreImages,
} from "@/lib/homeFirestoreImages";

/** Cadre produit : image en pleine largeur/hauteur (object-cover), sans bandes latérales. */
const CATALOG_IMG_OUTER =
  "relative overflow-hidden border-2 border-[#10294B] shadow-[inset_0_0_0_1px_rgba(206,32,41,0.35)]";

/**
 * Mobile : ratio modéré (9/16 laissait une zone image disproportionnée vs le texte).
 * Desktop : la colonne image suit la hauteur du texte (voir lg:aspect-auto).
 */
const MOBILE_IMG_ASPECT = "max-lg:aspect-[4/3]";

function TrustPills() {
  const pills = [
    { t: "Retour sous 24h*", k: "24h" },
    { t: "Sans engagement", k: "eng" },
    { t: "Antibes & alentours", k: "loc" },
  ];
  return (
    <div className="flex flex-wrap justify-center gap-2 lg:justify-start">
      {pills.map(({ t, k }) => (
        <span
          key={k}
          className="rounded-full border border-[#10294B]/15 bg-white/80 px-3 py-1.5 text-xs font-semibold text-[#10294B] shadow-sm"
        >
          {t}
        </span>
      ))}
    </div>
  );
}

function SectionHeading({
  id,
  title,
  subtitle,
  step,
}: {
  id: string;
  title: string;
  subtitle: string;
  step: string;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 border-b border-slate-200/60 pb-6 lg:mb-10 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
      <div className="flex items-start gap-4">
        <span
          className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#CE2029] font-lobster text-lg text-white shadow-md shadow-[#CE2029]/25"
          aria-hidden
        >
          {step}
        </span>
        <div>
          <h2
            id={id}
            className="font-lobster text-3xl leading-tight text-[#10294B] lg:text-[2.15rem]"
          >
            {title}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 lg:text-[15px]">
            {subtitle}
          </p>
        </div>
      </div>
      <div className="hidden lg:block lg:shrink-0">
        <div className="h-1 w-24 rounded-full bg-gradient-to-r from-[#CE2029] to-[#CE2029]/40" />
      </div>
    </div>
  );
}

function CatalogCard({
  item,
  imageUrl,
}: {
  item: ClientCatalogEntry;
  imageUrl?: string;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailsPanelId = useId();
  const primaryCta = item.primaryCta ?? "S'abonner";
  const tag =
    item.badge === "popular"
      ? "Top vente"
      : item.badge === "family"
        ? "Familles"
        : null;

  return (
    <article className="group/card flex h-fit min-h-0 w-full flex-col overflow-hidden rounded-2xl bg-white shadow-[0_2px_24px_-6px_rgba(16,41,75,0.12)] ring-1 ring-slate-200/50 transition duration-300 hover:shadow-[0_16px_48px_-12px_rgba(16,41,75,0.2)] hover:ring-slate-300/60 lg:grid lg:grid-cols-[minmax(200px,32%)_minmax(0,1fr)] lg:grid-rows-[auto] lg:items-stretch lg:gap-0">
      {/*
        Mobile : ratio 4/3 (plus compact que l’ancien 9/16). Desktop : colonne image alignée sur la hauteur du texte.
      */}
      <div className="relative mx-auto flex w-full max-w-[min(100%,340px)] shrink-0 flex-col max-lg:self-start sm:max-w-[360px] lg:mx-0 lg:min-h-0 lg:h-full lg:min-w-0">
        {tag ? (
          <span className="absolute left-3 top-3 z-10 rounded-full bg-[#CE2029] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-md sm:left-4 sm:top-4 lg:left-3 lg:top-3">
            {tag}
          </span>
        ) : null}
        <div
          className={`relative w-full shrink-0 overflow-hidden ${MOBILE_IMG_ASPECT} lg:min-h-0 lg:shrink lg:flex-1 lg:overflow-visible lg:aspect-auto`}
        >
          <div
            className={`${CATALOG_IMG_OUTER} absolute inset-0 rounded-t-2xl bg-slate-100 lg:relative lg:inset-auto lg:h-full lg:min-h-0 lg:rounded-bl-2xl lg:rounded-tl-2xl lg:rounded-tr-none lg:rounded-br-none`}
          >
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt={item.name}
                className="h-full w-full object-cover object-top"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <span className="h-28 w-28 animate-pulse rounded-xl bg-slate-200/90" />
              </div>
            )}
          </div>
        </div>
        <h3 className="px-4 pb-1 pt-2 text-center font-lobster text-2xl leading-tight text-[#CE2029] lg:hidden">
          {item.name}
        </h3>
      </div>

      <div className="flex min-h-0 min-w-0 flex-col justify-start border-t border-slate-100/90 px-4 pb-5 pt-3 max-lg:flex-none lg:min-h-0 lg:h-full lg:border-l lg:border-t-0 lg:border-l-slate-200/80 lg:px-8 lg:py-6 xl:px-10">
        <h3 className="hidden font-lobster text-[1.85rem] leading-tight text-[#CE2029] lg:block">
          {item.name}
        </h3>
        <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 lg:mt-2">
          Tarif
        </p>
        <p className="text-center text-2xl font-bold tracking-tight text-[#10294B] lg:text-left lg:text-3xl">
          {item.priceLine}
        </p>
        <p className="mt-3 text-center text-sm leading-relaxed text-slate-600 lg:text-left lg:text-[15px] lg:leading-relaxed">
          {item.detailLine}
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-stretch lg:mt-6">
          <button
            type="button"
            aria-expanded={detailsOpen}
            aria-controls={detailsPanelId}
            onClick={() => setDetailsOpen((o) => !o)}
            className="inline-flex min-h-[50px] shrink-0 items-center justify-center gap-2 rounded-xl border-2 border-[#10294B]/20 bg-white px-6 text-sm font-bold text-[#10294B] transition hover:border-[#10294B]/35 hover:bg-[#10294B]/[0.04] sm:min-w-[140px]"
          >
            {detailsOpen ? "Masquer les détails" : "Voir le détail"}
            <span
              className={`text-xs transition-transform duration-200 ${detailsOpen ? "rotate-180" : ""}`}
              aria-hidden
            >
              ▼
            </span>
          </button>
          <Link
            href={`/espace-client/recap?plan=${encodeURIComponent(item.recapPlanId)}`}
            className="inline-flex min-h-[50px] flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#CE2029] to-[#c41e26] px-6 text-center text-sm font-bold text-white shadow-lg shadow-[#CE2029]/25 transition hover:from-[#b91b24] hover:to-[#a91820] hover:shadow-xl sm:text-base"
          >
            {primaryCta}
            <span
              className="transition group-hover/card:translate-x-0.5"
              aria-hidden
            >
              →
            </span>
          </Link>
        </div>

        <div
          id={detailsPanelId}
          role="region"
          aria-label={`Détails ${item.name}`}
          hidden={!detailsOpen}
          className={
            detailsOpen
              ? "mt-4 rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 sm:px-5 sm:py-4"
              : undefined
          }
        >
          <ul className="space-y-2.5 text-left text-sm leading-relaxed text-slate-700">
            {item.bullets.map((line, i) => (
              <li key={`${item.imageKey}-b${i}`} className="flex gap-2.5">
                <span
                  className="mt-0.5 shrink-0 font-bold text-[#CE2029]"
                  aria-hidden
                >
                  ·
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}

export function ClientProductCatalog() {
  const [images, setImages] = useState<HomeFirestoreImages>({});

  useEffect(() => {
    loadHomeFirestoreImages().then(setImages);
  }, []);

  return (
    <div className="space-y-12 lg:space-y-16">
      <div className="rounded-2xl border border-slate-200/40 bg-white/60 px-5 py-5 shadow-sm backdrop-blur-sm sm:px-7 sm:py-6 lg:flex lg:items-center lg:justify-between lg:gap-8">
        <p className="text-center text-sm leading-relaxed text-slate-600 lg:max-w-2xl lg:text-left lg:text-[15px]">
          Repassage professionnel, collecte et livraison à domicile.{" "}
          <span className="font-semibold text-[#10294B]">Sans engagement</span>{" "}
          sur les abonnements — résiliation possible dès le 2ᵉ mois.
        </p>
        <div className="mt-4 flex justify-center lg:mt-0 lg:shrink-0">
          <TrustPills />
        </div>
      </div>

      <section aria-labelledby="choose-abo" className="scroll-mt-24">
        <SectionHeading
          id="choose-abo"
          step="1"
          title="Choisir un abonnement"
          subtitle="Chaque ligne est une formule complète : comparez les volumes, puis un récapitulatif sur ce site avant le paiement sécurisé Stripe."
        />
        <ul className="flex flex-col gap-6 lg:gap-7">
          {CLIENT_SUBSCRIPTION_ITEMS.map((item) => (
            <li key={item.imageKey}>
              <CatalogCard item={item} imageUrl={images[item.imageKey]} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="choose-pack" className="scroll-mt-24">
        <SectionHeading
          id="choose-pack"
          step="2"
          title="Sans abonnement"
          subtitle="Collecte ponctuelle : même principe — récapitulatif sur ce site, puis paiement Stripe."
        />
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2 lg:gap-7">
          {CLIENT_PACK_ITEMS.map((item) => (
            <CatalogCard
              key={item.imageKey}
              item={item}
              imageUrl={images[item.imageKey]}
            />
          ))}
        </div>
      </section>

      <p className="rounded-lg bg-slate-50/80 px-4 py-3 text-center text-xs leading-relaxed text-slate-500 lg:text-left">
        * Délai indicatif sous réserve de disponibilité. Après paiement, votre
        compte est activé par l&apos;équipe ; réservez ensuite vos créneaux dans
        l&apos;application mobile.
      </p>
    </div>
  );
}
