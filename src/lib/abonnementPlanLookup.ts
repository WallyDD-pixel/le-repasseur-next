/**
 * Correspondance plan catalogue / Stripe (`recapPlanId`, ex. « Marmo »)
 * ↔ document Firestore `abonnements` (id parfois auto-généré).
 */

/** Id Firestore legacy de la fiche Marmo (nom = « Marmo »). */
export const MARMO_LEGACY_FIRESTORE_DOC_ID = "QmRcGWVri4TxnqUQkrVi";

/** IDs documents quand l’id Firestore ≠ le recapPlanId. */
export const LEGACY_ABONNEMENT_DOC_IDS: Record<string, readonly string[]> = {
  Marmo: [MARMO_LEGACY_FIRESTORE_DOC_ID],
  "Super Héros": ["Super hero", "Super Hero"],
  "Super hero": ["Super hero", "Super Hero"],
  "Super Hero": ["Super hero", "Super Hero"],
};

/** Variantes du champ `nom` en base (recherche where nom == …). */
export const ABONNEMENT_NOM_ALIASES: Record<string, readonly string[]> = {
  Marmo: ["Marmo"],
  "Super Héros": [
    "Super Héros",
    "Super hero",
    "Super Hero",
    "Super Heros",
    "Super Héro",
    "Super Heroe",
  ],
  "Super hero": [
    "Super Héros",
    "Super hero",
    "Super Hero",
    "Super Heros",
    "Super Héro",
    "Super Heroe",
  ],
};

export function normalizePlanLookupKey(planId: string): string {
  return planId.trim().replace(/\+/g, " ");
}

export function legacyDocIdsForPlan(planId: string): string[] {
  const key = normalizePlanLookupKey(planId);
  if (!key) return [];
  const direct = LEGACY_ABONNEMENT_DOC_IDS[key];
  if (direct?.length) return [...direct];
  const ci = Object.entries(LEGACY_ABONNEMENT_DOC_IDS).find(
    ([k]) => k.toLowerCase() === key.toLowerCase()
  );
  return ci ? [...ci[1]] : [];
}

export function nomAliasesForPlan(planId: string): string[] {
  const key = normalizePlanLookupKey(planId);
  if (!key) return [];
  const fromMap = ABONNEMENT_NOM_ALIASES[key];
  if (fromMap?.length) return [...fromMap];
  const ci = Object.entries(ABONNEMENT_NOM_ALIASES).find(
    ([k]) => k.toLowerCase() === key.toLowerCase()
  );
  if (ci) return [...ci[1]];
  return [key];
}
