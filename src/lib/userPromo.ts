/** Réduction en % (0–100) sur le tarif catalogue au prochain paiement / renouvellement. */

export type UserPromoPercents = {
  abonnement: number;
  produit: number;
};

const ABON_KEYS = [
  "promoAbonnementPourcent",
  "promoAbonnementPercent",
  "promoAbonnement",
  "promo_abonnement_pourcent",
] as const;

const PRODUIT_KEYS = [
  "promoProduitPourcent",
  "promoProduitPercent",
  "promoProduit",
  "promo_produit_pourcent",
] as const;

function clampPercent(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n * 100) / 100));
}

function readPercent(data: Record<string, unknown>, keys: readonly string[]): number {
  for (const k of keys) {
    const raw = data[k];
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return clampPercent(raw);
    }
    if (typeof raw === "string" && raw.trim()) {
      const n = Number.parseFloat(raw.replace(",", ".").trim());
      if (Number.isFinite(n)) return clampPercent(n);
    }
  }
  return 0;
}

export function parseUserPromoPercents(
  data: Record<string, unknown> | undefined
): UserPromoPercents {
  const d = data ?? {};
  return {
    abonnement: readPercent(d, ABON_KEYS),
    produit: readPercent(d, PRODUIT_KEYS),
  };
}

/** Applique une réduction en % sur un montant en centimes (arrondi entier). */
export function applyPromoPercentToCents(
  baseCents: number,
  promoPercent: number
): number {
  if (baseCents <= 0) return baseCents;
  const p = clampPercent(promoPercent);
  if (p <= 0) return baseCents;
  if (p >= 100) return 0;
  return Math.max(0, Math.round((baseCents * (100 - p)) / 100));
}

export function promoPercentForPlanType(
  promos: UserPromoPercents,
  isSubscription: boolean
): number {
  return isSubscription ? promos.abonnement : promos.produit;
}

export function formatEurosFromCents(cents: number): string {
  const euros = cents / 100;
  const rounded =
    Math.abs(euros - Math.round(euros)) < 0.001
      ? String(Math.round(euros))
      : euros.toFixed(2).replace(/\.?0+$/, "");
  return `${rounded}€`;
}
