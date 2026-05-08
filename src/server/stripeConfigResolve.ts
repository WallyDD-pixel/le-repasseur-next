import "server-only";

import {
  STRIPE_SETTINGS_COLLECTION,
  STRIPE_SETTINGS_DOC_ID,
} from "@/lib/stripeFirestorePaths";
import {
  isSubscriptionRecapPlan,
  stripePriceIdForPlan,
} from "@/lib/stripePlans";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import { resolveStripePriceIdFromFirestoreCatalog } from "@/server/stripeCatalogPriceResolve";

export async function resolveStripeSecret(): Promise<string | undefined> {
  const db = getAdminFirestore();
  if (db) {
    try {
      const snap = await db
        .collection(STRIPE_SETTINGS_COLLECTION)
        .doc(STRIPE_SETTINGS_DOC_ID)
        .get();
      const sk = snap.data()?.secretKey;
      if (typeof sk === "string" && sk.trim()) return sk.trim();
    } catch (e) {
      console.error("[stripe] Lecture secretKey Firestore :", e);
    }
  }
  return process.env.STRIPE_SECRET_KEY?.trim();
}

export async function resolveStripePriceId(
  planId: string
): Promise<string | undefined> {
  const db = getAdminFirestore();
  if (db) {
    try {
      const snap = await db
        .collection(STRIPE_SETTINGS_COLLECTION)
        .doc(STRIPE_SETTINGS_DOC_ID)
        .get();
      const prices = snap.data()?.prices as Record<string, unknown> | undefined;
      const id = prices?.[planId];
      if (typeof id === "string" && id.trim()) return id.trim();

      const fromCatalog = await resolveStripePriceIdFromFirestoreCatalog(
        db,
        planId,
        /* packsFirst */ !isSubscriptionRecapPlan(planId)
      );
      if (fromCatalog) return fromCatalog;
    } catch (e) {
      console.error("[stripe] Lecture prix Firestore :", e);
    }
  }
  return stripePriceIdForPlan(planId);
}
