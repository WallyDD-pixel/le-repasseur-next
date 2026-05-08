import * as admin from "firebase-admin";

/**
 * Initialise l’app Firebase Admin (Auth + Firestore).
 * Nécessite `FIREBASE_SERVICE_ACCOUNT_JSON` (JSON du compte de service sur une ligne).
 */
export function getFirebaseAdminApp(): admin.app.App | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;

  try {
    if (!admin.apps.length) {
      const cred = JSON.parse(raw) as admin.ServiceAccount;
      admin.initializeApp({
        credential: admin.credential.cert(cred),
      });
    }
    return admin.app();
  } catch {
    console.error(
      "[firebase-admin] Initialisation impossible : vérifiez FIREBASE_SERVICE_ACCOUNT_JSON."
    );
    return null;
  }
}

/**
 * Firestore serveur (contourne les règles de sécurité — réservé aux routes API Node).
 */
export function getAdminFirestore(): admin.firestore.Firestore | null {
  return getFirebaseAdminApp() ? admin.firestore() : null;
}
