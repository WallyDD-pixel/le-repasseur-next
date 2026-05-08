import {
  CLIENT_PACK_ITEMS,
  CLIENT_SUBSCRIPTION_ITEMS,
} from "@/lib/clientCatalog";

/** Identifiants d’offre connus du catalogue (récap legacy + métadonnées Stripe). */
export const CHECKOUT_PLAN_IDS = new Set(
  [...CLIENT_SUBSCRIPTION_ITEMS, ...CLIENT_PACK_ITEMS].map((p) => p.recapPlanId)
);

export function isCheckoutPlanId(id: string): boolean {
  return CHECKOUT_PLAN_IDS.has(id);
}

/** Abonnement récurrent vs paiement unique (pack). */
export function isSubscriptionRecapPlan(planId: string): boolean {
  return CLIENT_SUBSCRIPTION_ITEMS.some((p) => p.recapPlanId === planId);
}

const PLAN_TO_STRIPE_PRICE_ENV: Record<string, string> = {
  Mino: "STRIPE_PRICE_MINO",
  Solo: "STRIPE_PRICE_SOLO",
  Duo: "STRIPE_PRICE_DUO",
  Marmo: "STRIPE_PRICE_MARMO",
  "Super Héros": "STRIPE_PRICE_SUPER_HEROS",
  "Pack 5 kg": "STRIPE_PRICE_PACK_5KG",
  "Pack 10 kg": "STRIPE_PRICE_PACK_10KG",
};

/** Nom de variable `.env` pour le `price_…` du plan (messages d’erreur / doc). */
export function stripePriceEnvVarNameForPlan(planId: string): string | undefined {
  return PLAN_TO_STRIPE_PRICE_ENV[planId];
}

/**
 * Prix Stripe (`price_…`) — à créer dans le tableau de bord Stripe pour chaque formule.
 */
export function stripePriceIdForPlan(planId: string): string | undefined {
  const map: Record<string, string | undefined> = {
    Mino: process.env.STRIPE_PRICE_MINO,
    Solo: process.env.STRIPE_PRICE_SOLO,
    Duo: process.env.STRIPE_PRICE_DUO,
    Marmo: process.env.STRIPE_PRICE_MARMO,
    "Super Héros": process.env.STRIPE_PRICE_SUPER_HEROS,
    "Pack 5 kg": process.env.STRIPE_PRICE_PACK_5KG,
    "Pack 10 kg": process.env.STRIPE_PRICE_PACK_10KG,
  };
  const raw = map[planId];
  return typeof raw === "string" ? raw.trim() || undefined : undefined;
}
