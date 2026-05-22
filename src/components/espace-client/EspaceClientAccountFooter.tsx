"use client";

import { useState } from "react";
import { getFirebaseAuth } from "@/lib/firebase";
import { Button, ButtonLink } from "@/components/ui/Button";

export function EspaceClientAccountFooter({
  subscribed,
}: {
  subscribed: boolean;
}) {
  const [portalBusy, setPortalBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onOpenStripePortal() {
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

  return (
    <nav
      className="border-t-2 border-[#10294B] pt-6"
      aria-label="Gestion du compte et de l’abonnement"
    >
      <ul className="flex flex-col gap-2.5 sm:max-w-md">
        <li>
          <ButtonLink
            href="/compte"
            variant="secondary"
            size="md"
            fullWidth
            className="!justify-start"
          >
            Modifier mon compte
          </ButtonLink>
        </li>
        <li>
          <ButtonLink
            href="/compte?action=close"
            variant="outline"
            size="md"
            fullWidth
            className="!justify-start"
          >
            Supprimer mon compte
          </ButtonLink>
        </li>
        <li>
          <Button
            type="button"
            variant="navy"
            size="md"
            fullWidth
            className="!justify-start"
            onClick={() => void onOpenStripePortal()}
            loading={portalBusy}
            disabled={!subscribed}
          >
            Informations de paiement
          </Button>
        </li>
      </ul>
      {error ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </nav>
  );
}
