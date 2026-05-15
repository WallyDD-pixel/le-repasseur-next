import "server-only";

import * as admin from "firebase-admin";

import { getAdminFirestore, getFirebaseAdminApp } from "@/server/firebaseAdmin";

const USERS_COLLECTION = "users";

export type VerifiedFirebaseUser = {
  uid: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
};

function pickEmailFromUserRecord(
  rec: admin.auth.UserRecord
): string | undefined {
  if (typeof rec.email === "string" && rec.email.trim()) {
    return rec.email.trim();
  }
  return undefined;
}

/**
 * Vérifie un jeton Firebase ID (Authorization côté client).
 * Enrichit l’e-mail via `getUser` + document `users/{uid}` : le JWT ne contient
 * pas toujours `email`, alors que Stripe Checkout a besoin de `customer_email`.
 */
export async function verifyFirebaseUserIdToken(
  idToken: string
): Promise<VerifiedFirebaseUser | null> {
  const t = idToken.trim();
  if (!t || !getFirebaseAdminApp()) return null;
  try {
    const d = await admin.auth().verifyIdToken(t);
    let email =
      typeof d.email === "string" && d.email.trim() ? d.email.trim() : undefined;
    let name =
      typeof d.name === "string" && d.name.trim() ? d.name.trim() : undefined;

    try {
      const rec = await admin.auth().getUser(d.uid);
      const fromRec = pickEmailFromUserRecord(rec);
      if (fromRec) email = fromRec;
      if (
        typeof rec.displayName === "string" &&
        rec.displayName.trim() &&
        !name
      ) {
        name = rec.displayName.trim();
      }
    } catch {
      /* garder les champs du jeton */
    }

    const db = getAdminFirestore();
    if (db && !email) {
      try {
        const snap = await db.collection(USERS_COLLECTION).doc(d.uid).get();
        const data = snap.data();
        const raw = data?.email ?? data?.mail ?? data?.courriel;
        if (typeof raw === "string" && raw.trim()) email = raw.trim();
      } catch {
        /* ignore */
      }
    }

    return {
      uid: d.uid,
      email,
      emailVerified: d.email_verified,
      name,
    };
  } catch {
    return null;
  }
}
