import "server-only";

import * as admin from "firebase-admin";

import { getFirebaseAdminApp } from "@/server/firebaseAdmin";

export type VerifiedFirebaseUser = {
  uid: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
};

/**
 * Vérifie un jeton Firebase ID (Authorization côté client).
 * Retourne null si Admin SDK indisponible ou jeton invalide.
 */
export async function verifyFirebaseUserIdToken(
  idToken: string
): Promise<VerifiedFirebaseUser | null> {
  const t = idToken.trim();
  if (!t || !getFirebaseAdminApp()) return null;
  try {
    const d = await admin.auth().verifyIdToken(t);
    return {
      uid: d.uid,
      email: d.email,
      emailVerified: d.email_verified,
      name: typeof d.name === "string" ? d.name : undefined,
    };
  } catch {
    return null;
  }
}
