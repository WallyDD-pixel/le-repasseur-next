import * as admin from "firebase-admin";
import type Stripe from "stripe";

import { TRANSACTIONS_COLLECTION } from "@/lib/activiteAdmin";
import {
  findPlanOrProductData,
  resolvePlanCredits,
} from "@/lib/planCreditsResolve";
import {
  emailFromStripeMetadata,
  firebaseUidFromStripeMetadata,
  planIdFromStripeMetadata,
  recapPlanIdFromStripePriceId,
  recapPlanIdFromSubscriptionAmountCents,
} from "@/lib/stripeMetadataLegacy";
import { isSubscriptionRecapPlan } from "@/lib/stripePlans";
import { isTestOfferPlanId } from "@/lib/testPaniereOffer";
import {
  quotaSnapshotFromUserData,
  coerceQuotaNumber,
  coerceQuotaReservations,
} from "@/lib/userQuotaAudit";
import { userQuotaAuditBatchSet } from "@/server/userQuotaAudit";

function coerceUserNumber(raw: unknown, fallback = 0): number {
  return coerceQuotaNumber(raw, fallback);
}

function coerceUserReservations(raw: unknown): number {
  return coerceQuotaReservations(raw);
}

export type StripeCreditsApplyResult = {
  applied: boolean;
  idempotent: boolean;
  planId: string | null;
  credits: { reservations: number; kg: number } | null;
};

/**
 * Applique les crédits (collectes + kg) de façon idempotente.
 * Utilise une écriture atomique (batch) et addition explicite pour éviter
 * les échecs `FieldValue.increment` quand les champs sont des chaînes en base.
 */
export async function applyStripeCreditsIdempotent(
  db: admin.firestore.Firestore,
  params: {
    uid: string;
    txDocId: string;
    planId: string;
    amountEuros: number | null;
    txPayload: Record<string, unknown>;
    setRole?: boolean;
  }
): Promise<StripeCreditsApplyResult> {
  const { uid, txDocId, planId, amountEuros, txPayload, setRole = false } =
    params;

  const txRef = db.collection(TRANSACTIONS_COLLECTION).doc(txDocId);
  const userRef = db.collection("users").doc(uid);

  const txSnap = await txRef.get();
  const txExisting = txSnap.exists
    ? (txSnap.data() as Record<string, unknown>)
    : {};
  if (txExisting.creditsApplied === true) {
    return {
      applied: false,
      idempotent: true,
      planId,
      credits: null,
    };
  }

  const planData = await findPlanOrProductData(db, planId, amountEuros);
  const { addReservations, addKg } = resolvePlanCredits(planId, planData);

  const userSnap = await userRef.get();
  const userData = (userSnap.data() ?? {}) as Record<string, unknown>;
  const beforeQuota = quotaSnapshotFromUserData(userData);

  const updates: Record<string, unknown> = {
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (setRole && isSubscriptionRecapPlan(planId)) {
    updates.role = planId;
  }
  if (planId && isTestOfferPlanId(planId)) {
    updates.testOfferUsed = true;
    updates.eligibleTestOffer = false;
  }

  let credits: { reservations: number; kg: number } | null = null;
  if (addReservations != null) {
    updates.reservations =
      coerceUserReservations(userData.reservations) + addReservations;
  }
  if (addKg != null) {
    updates.collectes = coerceUserNumber(userData.collectes, 0) + addKg;
  }
  if (addReservations != null || addKg != null) {
    credits = {
      reservations: addReservations ?? 0,
      kg: addKg ?? 0,
    };
    txPayload.creditsApplied = true;
  }

  const batch = db.batch();
  batch.set(txRef, txPayload, { merge: true });
  batch.set(userRef, updates, { merge: true });

  if (credits != null) {
    const afterRole =
      setRole && isSubscriptionRecapPlan(planId) ? planId : beforeQuota.role;
    const source =
      txPayload.source === "checkout_confirm"
        ? "stripe_checkout"
        : "stripe_webhook_renewal";
    userQuotaAuditBatchSet(db, batch, {
      userId: uid,
      email:
        typeof userData.email === "string" ? userData.email.trim() : undefined,
      source,
      action: "increment",
      before: beforeQuota,
      after: {
        collectesKg:
          addKg != null
            ? beforeQuota.collectesKg + addKg
            : beforeQuota.collectesKg,
        reservations:
          addReservations != null
            ? beforeQuota.reservations + addReservations
            : beforeQuota.reservations,
        ...(afterRole ? { role: afterRole } : {}),
      },
      delta: {
        ...(addKg != null ? { collectesKg: addKg } : {}),
        ...(addReservations != null ? { reservations: addReservations } : {}),
      },
      planId,
      txDocId,
      stripeInvoiceId:
        typeof txPayload.stripeInvoiceId === "string"
          ? txPayload.stripeInvoiceId
          : undefined,
      stripeCheckoutSessionId:
        typeof txPayload.stripeCheckoutSessionId === "string"
          ? txPayload.stripeCheckoutSessionId
          : undefined,
    });
  }

  await batch.commit();

  return {
    applied: credits != null,
    idempotent: false,
    planId,
    credits,
  };
}

/** Résout l’id d’abonnement sur une facture (API Stripe legacy + Basil 2025+). */
export function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | undefined {
  const inv = invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null;
    parent?: {
      type?: string;
      subscription_details?: {
        subscription?: string | Stripe.Subscription | null;
        metadata?: Stripe.Metadata | null;
      } | null;
    } | null;
  };

  const legacy = inv.subscription;
  if (typeof legacy === "string" && legacy.startsWith("sub_")) return legacy;
  if (legacy && typeof legacy === "object" && typeof legacy.id === "string") {
    return legacy.id;
  }

  const parent = inv.parent;
  if (parent?.type === "subscription_details" && parent.subscription_details) {
    const sub = parent.subscription_details.subscription;
    if (typeof sub === "string" && sub.startsWith("sub_")) return sub;
    if (sub && typeof sub === "object" && typeof sub.id === "string") {
      return sub.id;
    }
  }

  return undefined;
}

/** Sources de métadonnées plan / utilisateur sur une facture d’abonnement. */
export function invoiceMetadataSources(
  invoice: Stripe.Invoice
): Array<Record<string, unknown> | null | undefined> {
  const inv = invoice as Stripe.Invoice & {
    subscription_details?: { metadata?: Stripe.Metadata | null } | null;
    parent?: {
      subscription_details?: { metadata?: Stripe.Metadata | null } | null;
    } | null;
  };
  return [
    invoice.metadata,
    inv.subscription_details?.metadata ?? undefined,
    inv.parent?.subscription_details?.metadata ?? undefined,
  ];
}

export function planIdFromCheckoutSession(session: Stripe.Checkout.Session): string {
  return planIdFromStripeMetadata(session.metadata);
}

type InvoiceLineLike = Stripe.InvoiceLineItem & {
  price?: { id?: string } | string | null;
  plan?: { id?: string } | null;
  pricing?: { price_details?: { price?: string } } | null;
  metadata?: Stripe.Metadata | null;
};

function priceIdFromInvoiceLine(line: InvoiceLineLike): string | undefined {
  const pricing = line.pricing?.price_details?.price;
  if (typeof pricing === "string" && pricing.startsWith("price_")) return pricing;

  const price = line.price;
  if (typeof price === "string" && price.startsWith("price_")) return price;
  if (price && typeof price === "object" && typeof price.id === "string") {
    return price.id;
  }

  const planId = line.plan?.id;
  if (typeof planId === "string" && planId.startsWith("price_")) return planId;

  return undefined;
}

function invoiceLineMetadataSources(
  invoice: Stripe.Invoice
): Array<Record<string, unknown> | null | undefined> {
  const lines = invoice.lines?.data ?? [];
  return lines.map((line) => (line as InvoiceLineLike).metadata);
}

/**
 * Résout plan + client à partir de la facture seule.
 * Ne dépend pas de `subscriptions.retrieve` (échoue si abonnement supprimé
 * ou si la clé API ne correspond pas au mode live/test de l’événement).
 */
export async function resolveInvoiceRenewalContext(
  stripe: Stripe,
  invoice: Stripe.Invoice
): Promise<{
  planId: string;
  customerEmail: string;
  firebaseUid: string;
  subscriptionId?: string;
  usedInvoiceFallback: boolean;
}> {
  const metaSources = [
    ...invoiceMetadataSources(invoice),
    ...invoiceLineMetadataSources(invoice),
  ];

  let planId = planIdFromStripeMetadata(...metaSources);

  if (!planId) {
    const lines = invoice.lines?.data ?? [];
    for (const line of lines) {
      const priceId = priceIdFromInvoiceLine(line as InvoiceLineLike);
      if (!priceId) continue;
      planId = recapPlanIdFromStripePriceId(priceId) || "";
      if (planId) break;
    }
  }

  if (!planId) {
    planId =
      recapPlanIdFromSubscriptionAmountCents(invoice.amount_paid) || "";
  }

  let customerEmail =
    invoice.customer_email?.trim().toLowerCase() ||
    emailFromStripeMetadata(...metaSources);

  let firebaseUid = firebaseUidFromStripeMetadata(...metaSources);
  const subscriptionId = subscriptionIdFromInvoice(invoice);
  let usedInvoiceFallback = true;

  if (subscriptionId && (!planId || !firebaseUid || !customerEmail)) {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      usedInvoiceFallback = false;
      if (!planId) {
        planId = planIdFromStripeMetadata(sub.metadata, ...metaSources);
      }
      if (!planId) {
        const item = sub.items?.data?.[0];
        const priceId =
          item?.price?.id?.trim() || item?.plan?.id?.trim() || "";
        if (priceId) {
          planId = recapPlanIdFromStripePriceId(priceId) || "";
        }
      }
      if (!firebaseUid) {
        firebaseUid = firebaseUidFromStripeMetadata(sub.metadata);
      }
      if (!customerEmail) {
        customerEmail = emailFromStripeMetadata(sub.metadata);
      }
    } catch (e) {
      console.warn(
        "[stripe/webhook] subscriptions.retrieve ignoré — repli sur la facture",
        subscriptionId,
        e instanceof Error ? e.message : e
      );
    }
  }

  if (!customerEmail) {
    const customerId =
      typeof invoice.customer === "string"
        ? invoice.customer
        : invoice.customer && typeof invoice.customer === "object"
          ? invoice.customer.id
          : "";
    if (customerId.startsWith("cus_")) {
      try {
        const customer = await stripe.customers.retrieve(customerId);
        if (!customer.deleted && "email" in customer && customer.email) {
          customerEmail = customer.email.trim().toLowerCase();
        }
      } catch {
        /* ignore */
      }
    }
  }

  return {
    planId,
    customerEmail,
    firebaseUid,
    subscriptionId,
    usedInvoiceFallback,
  };
}
