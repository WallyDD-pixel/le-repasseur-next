/** Fiche Firestore `produits` — « Première panière test » (legacy). */
export const TEST_PANIERE_PRODUCT_NOM = "Première panière test";

export const TEST_PANIERE_RECAP_PLAN_ID = TEST_PANIERE_PRODUCT_NOM;

const LEGACY_TEST_PLAN_IDS = new Set(["Essai 1€"]);

/** Plans Stripe / récap encore présents en base pour d’anciens paiements. */
export function isTestOfferPlanId(planId: string): boolean {
  const id = planId.trim();
  return id === TEST_PANIERE_RECAP_PLAN_ID || LEGACY_TEST_PLAN_IDS.has(id);
}
