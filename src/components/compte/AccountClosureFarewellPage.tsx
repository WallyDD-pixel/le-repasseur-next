"use client";

import Link from "next/link";
import { getRetentionReasons } from "@/lib/accountClosureEligibility";
import { Button, ButtonLink } from "@/components/ui/Button";

type Props = {
  firstName?: string;
  roleLabel?: string;
  userData?: Record<string, unknown>;
  isSubscribed: boolean;
  stayHref: string;
  onOpenStripePortal?: () => void;
  portalBusy?: boolean;
  onCloseAccount?: () => void;
  closing?: boolean;
};

export function AccountClosureFarewellPage({
  firstName,
  roleLabel,
  userData,
  isSubscribed,
  stayHref,
  onOpenStripePortal,
  portalBusy = false,
  onCloseAccount,
  closing = false,
}: Props) {
  const reasons = getRetentionReasons(userData);
  const name = firstName?.trim();
  const headline = name
    ? `${name}, vous nous quittez déjà ?`
    : "Vous nous quittez déjà ?";

  return (
    <div className="space-y-8">
      <header className="text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#CE2029]">
          On ne vous dit pas au revoir
        </p>
        <h2 className="mt-3 font-serif text-3xl font-bold leading-tight text-[#10294B] sm:text-4xl">
          {headline}
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-slate-600">
          Le Repasseur, c&apos;est du temps pour vous, du linge impeccable et des
          collectes sans contrainte. Avant de partir, voyons si on peut encore
          vous simplifier la vie.
        </p>
      </header>

      {reasons.length > 0 ? (
        <section
          className="rounded-2xl border border-[#10294B]/10 bg-gradient-to-br from-[#10294B]/[0.04] to-white px-6 py-6 shadow-sm"
          aria-labelledby="retention-benefits"
        >
          <h3
            id="retention-benefits"
            className="text-center text-sm font-bold uppercase tracking-wider text-[#10294B]"
          >
            Il vous reste encore
          </h3>
          <ul className="mt-5 space-y-4">
            {reasons.map((r) => (
              <li
                key={r.code}
                className="flex gap-4 rounded-xl border border-white/80 bg-white/90 px-4 py-3 shadow-sm"
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#CE2029]/10 text-lg"
                  aria-hidden
                >
                  {r.code === "kg" ? "⚖️" : "📦"}
                </span>
                <p className="text-sm leading-relaxed text-[#10294B]">
                  <strong className="text-[#CE2029]">{r.highlight}</strong>{" "}
                  {r.detail}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-center text-sm text-slate-600">
            Réservez une collecte dans l&apos;application — c&apos;est le meilleur
            moyen d&apos;en profiter.
          </p>
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-slate-50/80 px-6 py-5 text-center">
          <p className="text-sm leading-relaxed text-slate-600">
            {roleLabel ? (
              <>
                Vous étiez abonné·e à{" "}
                <strong className="text-[#10294B]">{roleLabel}</strong>. Un
                problème, une question ? On peut vous aider avant que vous
                partiez.
              </>
            ) : (
              <>
                Une question sur le service, une commune, une formule ? On est
                là pour vous répondre.
              </>
            )}
          </p>
        </section>
      )}

      <div className="flex flex-col items-stretch gap-3 sm:mx-auto sm:max-w-md">
        <ButtonLink href={stayHref} variant="primary" size="lg" fullWidth>
          Je reste — retour à mon espace
        </ButtonLink>
        <ButtonLink href="/contact" variant="secondary" size="md" fullWidth>
          Contacter l&apos;équipe
        </ButtonLink>
      </div>

      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center" aria-hidden>
          <div className="w-full border-t border-slate-200" />
        </div>
        <p className="relative mx-auto w-fit bg-[var(--page-bg,#f8fafc)] px-4 text-xs font-medium uppercase tracking-wider text-slate-400">
          Fermeture du compte
        </p>
      </div>

      {isSubscribed ? (
        <section className="rounded-2xl border border-amber-200/80 bg-amber-50/90 px-5 py-5">
          <p className="text-sm font-semibold text-[#10294B]">
            Pour supprimer votre compte, résiliez d&apos;abord votre abonnement
          </p>
          <p className="mt-2 text-sm leading-relaxed text-amber-950/90">
            Tant que votre formule est active, la fermeture n&apos;est pas
            possible. Une fois l&apos;abonnement arrêté, vous pourrez fermer votre
            compte ici (réactivation possible en vous reconnectant).
          </p>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-amber-950">
            <li>
              Ouvrez le <strong>portail de paiement sécurisé</strong> (Stripe).
            </li>
            <li>
              Choisissez <strong>« Annuler l&apos;abonnement »</strong> ou
              désactivez le renouvellement automatique.
            </li>
            <li>
              Revenez sur cette page : le bouton de fermeture sera disponible.
            </li>
          </ol>
          {onOpenStripePortal ? (
            <Button
              type="button"
              variant="navy"
              size="md"
              fullWidth
              className="mt-4"
              onClick={() => onOpenStripePortal()}
              loading={portalBusy}
            >
              Résilier mon abonnement (portail Stripe)
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="md"
            fullWidth
            className="mt-3 opacity-60"
            disabled
            aria-disabled
          >
            Fermer mon compte — après résiliation
          </Button>
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white px-5 py-5 text-center">
          <p className="text-sm text-slate-600">
            Vous n&apos;avez pas d&apos;abonnement actif. Si vous confirmez la
            fermeture, votre compte sera désactivé (réactivation possible à tout
            moment).
          </p>
          {onCloseAccount ? (
            <Button
              type="button"
              variant="danger"
              size="md"
              fullWidth
              className="mt-4"
              onClick={() => onCloseAccount()}
              loading={closing}
            >
              Fermer définitivement mon compte
            </Button>
          ) : null}
          <p className="mt-4 text-xs text-slate-500">
            Vous changez d&apos;avis ?{" "}
            <Link
              href={stayHref}
              className="font-semibold text-[#CE2029] hover:underline"
            >
              Retour à l&apos;espace client
            </Link>
          </p>
        </section>
      )}
    </div>
  );
}
