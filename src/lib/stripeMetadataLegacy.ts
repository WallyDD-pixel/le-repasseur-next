import { nomAliasesForPlan, normalizePlanLookupKey } from "@/lib/abonnementPlanLookup";
import { stripePriceIdForPlan } from "@/lib/stripePlans";

type MetadataLike = Record<string, unknown> | null | undefined;

function strMeta(meta: MetadataLike, key: string): string {
  if (!meta || typeof meta !== "object") return "";
  const raw = meta[key];
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * Identifiant formule catalogue / Firestore (`recapPlanId`).
 * Nouveau site : `planId` — ancien site : `title`.
 */
export function planIdFromStripeMetadata(...sources: MetadataLike[]): string {
  for (const meta of sources) {
    const planId = strMeta(meta, "planId");
    if (planId) return normalizePlanLookupKey(planId);
  }
  for (const meta of sources) {
    const title = strMeta(meta, "title");
    if (title) return normalizePlanLookupKey(title);
  }
  return "";
}

/** `firebaseUid` dans les métadonnées Stripe. */
export function firebaseUidFromStripeMetadata(...sources: MetadataLike[]): string {
  for (const meta of sources) {
    const uid = strMeta(meta, "firebaseUid");
    if (uid) return uid;
  }
  return "";
}

/**
 * E-mail client pour retrouver `users` dans Firestore.
 * Nouveau : `userEmail` — ancien : `email`.
 */
export function emailFromStripeMetadata(...sources: MetadataLike[]): string {
  for (const meta of sources) {
    const userEmail = strMeta(meta, "userEmail");
    if (userEmail) return userEmail.toLowerCase();
  }
  for (const meta of sources) {
    const email = strMeta(meta, "email");
    if (email) return email.toLowerCase();
  }
  return "";
}

/**
 * Prix Stripe production de l’ancien site (live) → formule catalogue.
 * Complète `.env` quand les `price_…` ont changé entre l’ancien et le nouveau site.
 */
export const LEGACY_PRODUCTION_PRICE_TO_PLAN: Record<string, string> = {
  price_1Q4RJsGCDVPnzYlb2LDjzLJ2: "Mino",
  price_1SageHGCDVPnzYlb2cAoffDn: "Mino",
  price_1TWX1SGCDVPnzYlbWQn55gl1: "Solo",
  price_1RiGqrGCDVPnzYlb7GIvv3pU: "Solo",
  price_1RVpefGCDVPnzYlb5DCCWuvr: "Super Héros",
};

/** Repli : `price_…` legacy puis `.env` (`STRIPE_PRICE_MINO`, etc.). */
export function recapPlanIdFromStripePriceId(priceId: string): string | undefined {
  const id = priceId.trim();
  if (!id) return undefined;
  const legacyPlan = LEGACY_PRODUCTION_PRICE_TO_PLAN[id];
  if (legacyPlan) return normalizePlanLookupKey(legacyPlan);

  const plans = [
    "Mino",
    "Solo",
    "Duo",
    "Marmo",
    "Super Héros",
    "Pack 5 kg",
    "Pack 10 kg",
    "Recharge 5 kg",
    "Essai 1€",
  ] as const;
  for (const plan of plans) {
    if (stripePriceIdForPlan(plan) === id) return plan;
  }
  return undefined;
}

/** Repli montant mensuel (centimes) — abonnements legacy hors `.env`. */
const SUBSCRIPTION_CENTS_TO_PLAN: readonly [number, string][] = [
  [1900, "Mino"],
  [3900, "Solo"],
  [5900, "Duo"],
  [9900, "Marmo"],
  [19900, "Super Héros"],
];

export function recapPlanIdFromSubscriptionAmountCents(
  amountCents: number | null | undefined
): string | undefined {
  if (amountCents == null || !Number.isFinite(amountCents)) return undefined;
  for (const [cents, plan] of SUBSCRIPTION_CENTS_TO_PLAN) {
    if (amountCents === cents) return plan;
  }
  return undefined;
}

/**
 * Normalise un libellé legacy (`title`) vers un `nom` catalogue connu si besoin.
 */
export function normalizeLegacyPlanTitle(planId: string): string {
  const key = normalizePlanLookupKey(planId);
  if (!key) return "";
  const aliases = nomAliasesForPlan(key);
  return aliases[0] ?? key;
}
