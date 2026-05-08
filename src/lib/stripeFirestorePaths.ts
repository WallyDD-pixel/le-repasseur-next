/** Document unique pour la configuration Stripe (clés + prix) — Firestore. */
export const STRIPE_SETTINGS_COLLECTION = "siteSettings";
export const STRIPE_SETTINGS_DOC_ID = "stripe";

export type StripeSettingsFirestoreData = {
  publishableKey?: string;
  /** Ne jamais exposer au client public ; réservé à l’admin et à la lecture serveur (Admin SDK). */
  secretKey?: string;
  /** Clés = `recapPlanId` (ex. « Super Héros », « Pack 5 kg »). */
  prices?: Partial<Record<string, string>>;
  updatedAt?: unknown;
};
