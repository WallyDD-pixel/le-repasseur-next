import type { Firestore } from "firebase-admin/firestore";
import * as admin from "firebase-admin";

/** Enregistre les identifiants Stripe sur le profil utilisateur (sans écraser inutilement). */
export async function persistUserStripeIds(
  db: Firestore,
  uid: string,
  ids: { stripeCustomerId?: string; stripeSubscriptionId?: string }
): Promise<void> {
  const updates: Record<string, unknown> = {
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (
    typeof ids.stripeCustomerId === "string" &&
    ids.stripeCustomerId.startsWith("cus_")
  ) {
    updates.stripeCustomerId = ids.stripeCustomerId;
  }
  if (
    typeof ids.stripeSubscriptionId === "string" &&
    ids.stripeSubscriptionId.startsWith("sub_")
  ) {
    updates.stripeSubscriptionId = ids.stripeSubscriptionId;
  }

  if (Object.keys(updates).length <= 1) return;

  await db.collection("users").doc(uid).set(updates, { merge: true });
}
