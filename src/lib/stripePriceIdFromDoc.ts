const KEYS = ["stripePriceId", "stripe_price_id", "stripePrice"] as const;

function looksLikeStripePriceId(s: string): boolean {
  return /^price_[a-zA-Z0-9]+$/.test(s.trim());
}

/** Lit un identifiant `price_…` depuis une fiche Firestore (abonnement / produit). */
export function pickStripePriceIdFromFirestoreDoc(
  data: Record<string, unknown> | undefined
): string | undefined {
  if (!data) return undefined;
  for (const k of KEYS) {
    const v = data[k];
    if (typeof v === "string" && looksLikeStripePriceId(v)) return v.trim();
  }
  return undefined;
}
