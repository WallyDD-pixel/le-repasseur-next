import type { Firestore } from "firebase-admin/firestore";

import {
  legacyDocIdsForPlan,
  nomAliasesForPlan,
  normalizePlanLookupKey,
} from "@/lib/abonnementPlanLookup";
import { ABONNEMENTS_COLLECTION } from "@/lib/abonnementsAdmin";
import { isTestOfferPlanId } from "@/lib/testPaniereOffer";

/** Crédits mensuels par formule (repli si Firestore n’a pas collectes/kg). */
export const PLAN_DEFAULT_CREDITS: Record<
  string,
  { kg: number; collectes: number }
> = {
  Mino: { kg: 2.5, collectes: 1 },
  Solo: { kg: 5, collectes: 2 },
  Duo: { kg: 10, collectes: 4 },
  Marmo: { kg: 20, collectes: 4 },
  "Super Héros": { kg: 40, collectes: 4 },
  "Super hero": { kg: 40, collectes: 4 },
  "Pack 5 kg": { kg: 5, collectes: 1 },
  "Pack 10 kg": { kg: 10, collectes: 1 },
  "Recharge 5 kg": { kg: 5, collectes: 1 },
};

export function readPositiveNumber(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw === "string") {
    const n = Number.parseFloat(raw.replace(",", ".").trim());
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function defaultCreditsForPlan(planId: string): {
  kg: number;
  collectes: number;
} | null {
  const id = planId.trim();
  if (!id) return null;
  if (PLAN_DEFAULT_CREDITS[id]) return PLAN_DEFAULT_CREDITS[id];
  const key = Object.keys(PLAN_DEFAULT_CREDITS).find(
    (k) => k.toLowerCase() === id.toLowerCase()
  );
  return key ? PLAN_DEFAULT_CREDITS[key]! : null;
}

/** Charge abonnement / produit Firestore pour un `recapPlanId` (ex. « Marmo »). */
export async function findPlanOrProductData(
  db: Firestore,
  planId: string,
  amountEuros: number | null
): Promise<Record<string, unknown>> {
  if (!planId && amountEuros == null) return {};

  const planKey = normalizePlanLookupKey(planId);

  if (planKey) {
    const byId = await db.collection(ABONNEMENTS_COLLECTION).doc(planKey).get();
    if (byId.exists) return byId.data() as Record<string, unknown>;

    for (const legacyId of legacyDocIdsForPlan(planKey)) {
      if (legacyId === planKey) continue;
      const legacy = await db.collection(ABONNEMENTS_COLLECTION).doc(legacyId).get();
      if (legacy.exists) return legacy.data() as Record<string, unknown>;
    }

    for (const nom of nomAliasesForPlan(planKey)) {
      const byNomAbo = await db
        .collection(ABONNEMENTS_COLLECTION)
        .where("nom", "==", nom)
        .limit(1)
        .get();
      if (!byNomAbo.empty) {
        return byNomAbo.docs[0]!.data() as Record<string, unknown>;
      }
    }
  }

  if (planId) {
    const p = await db.collection("produits").doc(planId).get();
    if (p.exists) return p.data() as Record<string, unknown>;
  }

  if (planId) {
    const byNom = await db
      .collection("produits")
      .where("nom", "==", planId)
      .limit(1)
      .get();
    if (!byNom.empty) return byNom.docs[0]!.data() as Record<string, unknown>;

    const byRecap = await db
      .collection("produits")
      .where("recapPlanId", "==", planId)
      .limit(1)
      .get();
    if (!byRecap.empty) return byRecap.docs[0]!.data() as Record<string, unknown>;
  }

  if (amountEuros != null) {
    const all = await db.collection("produits").get();
    for (const d of all.docs) {
      const data = d.data() as Record<string, unknown>;
      const p = readPositiveNumber(data.prix ?? data.price);
      if (p != null && Math.abs(p - amountEuros) < 0.001) {
        return data;
      }
    }
  }

  return {};
}

/**
 * Crédits à ajouter sur `users` :
 * - `collectes` / `collecte` du plan → `users.reservations` (nombre de collectes)
 * - `kg` du plan → `users.collectes` (quota kg)
 */
export function resolvePlanCredits(
  planId: string,
  planData: Record<string, unknown>
): { addReservations: number | null; addKg: number | null } {
  const defaults = defaultCreditsForPlan(planId);

  const fromDocCollectes = readPositiveNumber(
    planData.collectes ?? planData.collecte
  );
  const fromDocKg = readPositiveNumber(planData.kg);

  if (planId && isTestOfferPlanId(planId)) {
    return {
      addReservations:
        fromDocCollectes ??
        readPositiveNumber(planData.collecte ?? planData.collectes) ??
        defaults?.collectes ??
        null,
      addKg: fromDocKg ?? defaults?.kg ?? null,
    };
  }

  return {
    addReservations: fromDocCollectes ?? defaults?.collectes ?? null,
    addKg: fromDocKg ?? defaults?.kg ?? null,
  };
}
