import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

/** Évite `auth/invalid-api-key` quand le .env définit une variable vide (`KEY=`) : `"" ?? défaut` gardait la chaîne vide. */
function envOr<T extends string>(raw: string | undefined, fallback: T): T {
  const t = raw?.trim();
  return (t ? t : fallback) as T;
}

const firebaseConfig = {
  apiKey: envOr(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    "AIzaSyDS86aEvc071-c0HTS8sJi_xQ01boa1q60"
  ),
  authDomain: envOr(
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    "repasseurflutter-7fc37.firebaseapp.com"
  ),
  projectId: envOr(
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    "repasseurflutter-7fc37"
  ),
  storageBucket: envOr(
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    "repasseurflutter-7fc37.appspot.com"
  ),
  messagingSenderId: envOr(
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    "348979158571"
  ),
  appId: envOr(
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    "1:348979158571:web:8c8214ab09b160b10c546e"
  ),
};

function getApp(): FirebaseApp {
  if (typeof window === "undefined") {
    throw new Error("Firebase : utilisation réservée au navigateur");
  }
  const apps = getApps();
  if (!apps.length) return initializeApp(firebaseConfig);
  return apps[0]!;
}

export function getFirebaseAuth(): Auth {
  return getAuth(getApp());
}

export function getFirebaseFirestore(): Firestore {
  return getFirestore(getApp());
}

export function getFirebaseStorage(): FirebaseStorage {
  return getStorage(getApp());
}
