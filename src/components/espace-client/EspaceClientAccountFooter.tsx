 "use client";

import Link from "next/link";
import { useState } from "react";
import { getFirebaseAuth } from "@/lib/firebase";

export function EspaceClientAccountFooter({
  subscribed,
}: {
  subscribed: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onOpenStripePortal() {
    setInfo(null);
    setError(null);
    if (!subscribed) {
      setError("Aucun abonnement actif à gérer.");
      return;
    }
    const u = getFirebaseAuth().currentUser;
    if (!u) {
      setError("Session expirée. Reconnectez-vous puis réessayez.");
      return;
    }
    setPortalBusy(true);
    try {
      const idToken = await u.getIdToken();
      const res = await fetch("/api/checkout/customer-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          returnUrl: `${window.location.origin}/espace-client`,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        url?: string;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.url) {
        setError(
          typeof data.error === "string"
            ? data.error
            : "Ouverture du portail Stripe impossible."
        );
        return;
      }
      window.location.assign(data.url);
    } catch {
      setError("Erreur réseau. Réessayez dans un instant.");
    } finally {
      setPortalBusy(false);
    }
  }

  async function onCancelSubscription() {
    setInfo(null);
    setError(null);
    if (!subscribed) {
      setError("Aucun abonnement actif à résilier.");
      return;
    }
    const ok = window.confirm(
      "Confirmer la résiliation ? Votre abonnement restera actif jusqu'à la fin de la période en cours."
    );
    if (!ok) return;

    const u = getFirebaseAuth().currentUser;
    if (!u) {
      setError("Session expirée. Reconnectez-vous puis réessayez.");
      return;
    }
    setBusy(true);
    try {
      const idToken = await u.getIdToken();
      const res = await fetch("/api/checkout/cancel-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
        currentPeriodEnd?: number | null;
      };
      if (!res.ok || !data.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : "Résiliation impossible pour le moment."
        );
        return;
      }
      const endDate =
        typeof data.currentPeriodEnd === "number" && data.currentPeriodEnd > 0
          ? new Date(data.currentPeriodEnd * 1000).toLocaleDateString("fr-FR")
          : null;
      setInfo(
        endDate
          ? `Résiliation enregistrée. L’abonnement prendra fin le ${endDate}.`
          : "Résiliation enregistrée. L’abonnement prendra fin à la prochaine échéance."
      );
    } catch {
      setError("Erreur réseau. Réessayez dans un instant.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <nav
      className="border-t-2 border-[#10294B] pt-6"
      aria-label="Gestion du compte et de l’abonnement"
    >
      <ul className="flex flex-col gap-3 pl-1 sm:pl-2">
        <li>
          <Link
            href="/compte"
            className="inline-block text-sm font-bold text-[#10294B] transition hover:underline sm:text-base"
          >
            Modifier mon compte
          </Link>
        </li>
        <li>
          <Link
            href="/compte?action=close"
            className="inline-block text-sm font-bold text-[#10294B] transition hover:underline sm:text-base"
          >
            Supprimer mon compte
          </Link>
        </li>
        <li>
          <button
            type="button"
            onClick={() => void onOpenStripePortal()}
            disabled={portalBusy || !subscribed}
            className="inline-block text-left text-sm font-bold text-[#10294B] transition hover:underline disabled:cursor-not-allowed disabled:opacity-60 sm:text-base"
          >
            {portalBusy
              ? "Ouverture du portail Stripe…"
              : "Gérer mon abonnement sur Stripe"}
          </button>
        </li>
        <li>
          <button
            type="button"
            onClick={() => void onCancelSubscription()}
            disabled={busy || portalBusy || !subscribed}
            className="inline-block text-left text-sm font-bold text-[#10294B] transition hover:underline disabled:cursor-not-allowed disabled:opacity-60 sm:text-base"
          >
            {busy ? "Résiliation en cours…" : "Résilier mon abonnement"}
          </button>
        </li>
      </ul>
      {info ? (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {info}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </nav>
  );
}
