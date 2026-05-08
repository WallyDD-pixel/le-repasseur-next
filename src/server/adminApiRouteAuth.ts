import "server-only";

import * as admin from "firebase-admin";
import type { NextRequest } from "next/server";

import { USERS_COLLECTION } from "@/lib/usersAdmin";
import { getAdminFirestore, getFirebaseAdminApp } from "@/server/firebaseAdmin";

export type AdminApiAuthOk = { ok: true; uid: string };
export type AdminApiAuthFail = { ok: false; error: string; status: number };

function bearerToken(req: NextRequest): string | null {
  const h = req.headers.get("authorization");
  if (!h?.startsWith("Bearer ")) return null;
  const t = h.slice(7).trim();
  return t || null;
}

/**
 * Routes API réservées au rôle `admin` (Firestore `users/{uid}.role`).
 * Nécessite Firebase Admin + jeton ID dans `Authorization: Bearer …`.
 */
export async function requireAdminApiUser(
  req: NextRequest
): Promise<AdminApiAuthOk | AdminApiAuthFail> {
  const token = bearerToken(req);
  if (!token) {
    return {
      ok: false,
      error: "Jeton d’authentification manquant (Authorization: Bearer …).",
      status: 401,
    };
  }

  if (!getFirebaseAdminApp()) {
    return {
      ok: false,
      error:
        "FIREBASE_SERVICE_ACCOUNT_JSON requis pour sécuriser cette route API.",
      status: 503,
    };
  }

  let decoded: admin.auth.DecodedIdToken;
  try {
    decoded = await admin.auth().verifyIdToken(token);
  } catch {
    return { ok: false, error: "Session invalide ou expirée.", status: 401 };
  }

  const db = getAdminFirestore();
  if (!db) {
    return {
      ok: false,
      error: "Firestore Admin indisponible.",
      status: 503,
    };
  }

  const role = (await db.collection(USERS_COLLECTION).doc(decoded.uid).get())
    .data()?.role;
  if (role !== "admin") {
    return { ok: false, error: "Accès réservé aux administrateurs.", status: 403 };
  }

  return { ok: true, uid: decoded.uid };
}
