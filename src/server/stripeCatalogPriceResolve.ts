import "server-only";

import type { Firestore } from "firebase-admin/firestore";

import { ABONNEMENTS_COLLECTION } from "@/lib/abonnementsAdmin";
import { PRODUITS_COLLECTION } from "@/lib/produitsAdmin";
import { pickStripePriceIdFromFirestoreDoc } from "@/lib/stripePriceIdFromDoc";

async function stripePriceFromCollectionDoc(
  db: Firestore,
  collectionPath: string,
  planId: string
): Promise<string | undefined> {
  const recap = await db
    .collection(collectionPath)
    .where("recapPlanId", "==", planId)
    .limit(1)
    .get();
  if (!recap.empty) {
    const id = pickStripePriceIdFromFirestoreDoc(
      recap.docs[0].data() as Record<string, unknown>
    );
    if (id) return id;
  }

  const nom = await db
    .collection(collectionPath)
    .where("nom", "==", planId)
    .limit(1)
    .get();
  if (!nom.empty) {
    const id = pickStripePriceIdFromFirestoreDoc(
      nom.docs[0].data() as Record<string, unknown>
    );
    if (id) return id;
  }

  if (collectionPath === PRODUITS_COLLECTION) {
    const direct = await db.collection(collectionPath).doc(planId).get();
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
