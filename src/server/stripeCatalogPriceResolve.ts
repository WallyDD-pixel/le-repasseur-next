import "server-only";

import type { Firestore } from "firebase-admin/firestore";

import {
  legacyDocIdsForPlan,
  nomAliasesForPlan,
  normalizePlanLookupKey,
} from "@/lib/abonnementPlanLookup";
import { ABONNEMENTS_COLLECTION } from "@/lib/abonnementsAdmin";
import { PRODUITS_COLLECTION } from "@/lib/produitsAdmin";
import { pickStripePriceIdFromFirestoreDoc } from "@/lib/stripePriceIdFromDoc";

async function stripePriceFromCollectionDoc(
  db: Firestore,
  collectionPath: string,
  planId: string
): Promise<string | undefined> {
  const planKey = normalizePlanLookupKey(planId);
  if (!planKey) return undefined;

  const recap = await db
    .collection(collectionPath)
    .where("recapPlanId", "==", planKey)
    .limit(1)
    .get();
  if (!recap.empty) {
    const id = pickStripePriceIdFromFirestoreDoc(
      recap.docs[0]!.data() as Record<string, unknown>
    );
    if (id) return id;
  }

  if (collectionPath === ABONNEMENTS_COLLECTION) {
    const direct = await db.collection(collectionPath).doc(planKey).get();
    if (direct.exists) {
      const id = pickStripePriceIdFromFirestoreDoc(
        direct.data() as Record<string, unknown>
      );
      if (id) return id;
    }

    for (const legacyId of legacyDocIdsForPlan(planKey)) {
      if (legacyId === planKey) continue;
      const legacy = await db.collection(collectionPath).doc(legacyId).get();
      if (legacy.exists) {
        const id = pickStripePriceIdFromFirestoreDoc(
          legacy.data() as Record<string, unknown>
        );
        if (id) return id;
      }
    }

    for (const nom of nomAliasesForPlan(planKey)) {
      const byNom = await db
        .collection(collectionPath)
        .where("nom", "==", nom)
        .limit(1)
        .get();
      if (!byNom.empty) {
        const id = pickStripePriceIdFromFirestoreDoc(
          byNom.docs[0]!.data() as Record<string, unknown>
        );
        if (id) return id;
      }
    }
    return undefined;
  }

  const nom = await db
    .collection(collectionPath)
    .where("nom", "==", planKey)
    .limit(1)
    .get();
  if (!nom.empty) {
    const id = pickStripePriceIdFromFirestoreDoc(
      nom.docs[0]!.data() as Record<string, unknown>
    );
    if (id) return id;
  }

  if (collectionPath === PRODUITS_COLLECTION) {
    const direct = await db.collection(collectionPath).doc(planKey).get();
    if (direct.exists) {
      const id = pickStripePriceIdFromFirestoreDoc(
        direct.data() as Record<string, unknown>
      );
      if (id) return id;
    }
  }

  return undefined;
}

/**
 * ID prix Stripe depuis les fiches catalogue Firestore (`abonnements`, `produits`),
 * où le champ `stripePriceId` (ou synonymes) est renseigné.
 *
 * Important : le montant (`prix` en euros) ne suffit pas pour Checkout — Stripe
 * exige toujours un objet Price référencé par `price_…`.
 */
export async function resolveStripePriceIdFromFirestoreCatalog(
  db: Firestore,
  planId: string,
  packsFirst: boolean
): Promise<string | undefined> {
  const subsFirst = ABONNEMENTS_COLLECTION;
  const packs = PRODUITS_COLLECTION;
  const ordered = packsFirst ? [packs, subsFirst] : [subsFirst, packs];
  for (const coll of ordered) {
    const id = await stripePriceFromCollectionDoc(db, coll, planId);
    if (id) return id;
  }
  return undefined;
}
