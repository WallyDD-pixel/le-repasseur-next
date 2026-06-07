import "server-only";

import { isSubscriptionRecapPlan } from "@/lib/stripePlans";
import {
  applyPromoPercentToCents,
  parseUserPromoPercents,
  promoPercentForPlanType,
  type UserPromoPercents,
} from "@/lib/userPromo";
import { resolveCheckoutEuroCents } from "@/server/checkoutEuroCentsResolve";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import { resolveStripePriceId } from "@/server/stripeConfigResolve";

export type CheckoutPricing = {
  baseEuroCents: number | undefined;
  finalEuroCents: number | undefined;
  promoPercent: number;
  promos: UserPromoPercents;
  /** Si true, ignorer le `price_…` Stripe et utiliser `price_data` (promo ou montant catalogue). */
  forceDynamicPrice: boolean;
};

async function loadUserPromos(uid: string | undefined): Promise<UserPromoPercents> {
  if (!uid) {
    return { abonnement: 0, produit: 0 };
  }
  const db = getAdminFirestore();
  if (!db) return { abonnement: 0, produit: 0 };
  try {
    const snap = await db.collection("users").doc(uid).get();
    if (!snap.exists) return { abonnement: 0, produit: 0 };
    return parseUserPromoPercents(snap.data() as Record<string, unknown>);
  } catch {
    return { abonnement: 0, produit: 0 };
  }
}

/**
 * Tarif checkout : catalogue Firestore / fallback, puis promo utilisateur si définie.
 */
export async function resolveCheckoutPricing(params: {
  planId: string;
  uid?: string;
}): Promise<CheckoutPricing> {
  const { planId, uid } = params;
  const promos = await loadUserPromos(uid);
  const isSub = isSubscriptionRecapPlan(planId);
  const promoPercent = promoPercentForPlanType(promos, isSub);

  const baseEuroCents = await resolveCheckoutEuroCents(planId);
  const finalEuroCents =
    baseEuroCents != null
      ? applyPromoPercentToCents(baseEuroCents, promoPercent)
      : undefined;

  const stripePriceId = await resolveStripePriceId(planId);
  const hasCatalogCents =
    typeof baseEuroCents === "number" && baseEuroCents >= 50;
  /** Promo ou absence de price Stripe → montant dynamique (catalogue − %). */
  const forceDynamicPrice =
    promoPercent > 0 ||
    !hasCatalogCents ||
    !(typeof stripePriceId === "string" && stripePriceId.trim());

  return {
    baseEuroCents,
    finalEuroCents,
    promoPercent,
    promos,
    forceDynamicPrice,
  };
}
