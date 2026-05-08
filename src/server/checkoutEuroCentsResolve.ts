import "server-only";

import type { Firestore } from "firebase-admin/firestore";

import { ABONNEMENTS_COLLECTION } from "@/lib/abonnementsAdmin";
import {
  euroCentsFromRecapPlanId,
} from "@/lib/catalogPlanEuros";
import { PRODUITS_COLLECTION } from "@/lib/produitsAdmin";
import { isSubscriptionRecapPlan } from "@/lib/stripePlans";
import { getAdminFirestore } from "@/server/firebaseAdmin";

function firestorePrixToCents(data: Record<string, unknown>): number | undefined {
  const raw = data.prix ?? data.price;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.round(raw * 100);
  }
  if (typeof raw === "string") {
    const t = raw.replace(/[^\d.,-]/g, "").replace(",", ".").trim();
    if (!t) return undefined;
    const n = parseFloat(t);
    if (Number.isFinite(n) && n > 0) return Math.round(n * 100);
  }
  return undefined;
}

async function centsFromCollection(
  db: Firestore,
  collectionPath: string,
  planId: string
): Promise<number | undefined> {
  const recap = await db
    .collection(collectionPath)
    .where("recapPlanId", "==", planId)
    .limit(1)
    .get();
  if (!recap.empty) {
    const cents = firestorePrixToCents(
      recap.docs[0].data() as Record<string, unknown>
    );
    if (cents != null && cents > 0) return cents;
  }

  const nom = await db
    .collection(collectionPath)
    .where("nom", "==", planId)
    .limit(1)
    .get();
  if (!nom.empty) {
    const cents = firestorePrixToCents(
      nom.docs[0].data() as Record<string, unknown>
    );
    if (cents != null && cents > 0) return cents;
  }

  if (collectionPath === PRODUITS_COLLECTION) {
    const direct = await db.collection(collectionPath).doc(planId).get();
    if (direct.exists) {
      const cents = firestorePrixToCents(
        direct.data() as Record<string, unknown>
      );
      if (cents != null && cents > 0) return cents;
    }
  }

  return undefined;
}

async function centsFromFirestoreCatalog(db: Firestore, planId: string): Promise<
  number | undefined
> {
  const packsFirst = !isSubscriptionRecapPlan(planId);
  const ordered = packsFirst
    ? [PRODUITS_COLLECTION, ABONNEMENTS_COLLECTION]
    : [ABONNEMENTS_COLLECTION, PRODUITS_COLLECTION];
  for (const coll of ordered) {
    const c = await centsFromCollection(db, coll, planId);
    if (c != null) return c;
  }
  return undefined;
}

/**
 * Montant en centimes pour Checkout (`price_data`) : Firestore (`prix` sur abonnements/produits)
 * si le Admin SDK est dispo ; sinon valeur dérivée du catalogue `clientCatalog.priceLine`.
 */
export async function resolveCheckoutEuroCents(planId: string): Promise<number | undefined> {
  const db = getAdminFirestore();
  if (db) {
    try {
      const fromDb = await centsFromFirestoreCatalog(db, planId);
      if (fromDb != null) return fromDb;
    } catch (e) {
      console.error("[stripe] Lecture montant Firestore catalogue :", e);
    }
  }
  return euroCentsFromRecapPlanId(planId);
}
