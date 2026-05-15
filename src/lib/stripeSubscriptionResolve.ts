import type Stripe from "stripe";

import {
  emailFromStripeMetadata,
  firebaseUidFromStripeMetadata,
  planIdFromStripeMetadata,
  recapPlanIdFromStripePriceId,
  recapPlanIdFromSubscriptionAmountCents,
} from "@/lib/stripeMetadataLegacy";

export type ResolvedStripeSubscriptionContext = {
  planId: string;
  firebaseUid: string;
  customerEmail: string;
};

function subscriptionAmountCents(sub: Stripe.Subscription): number | null {
  const item = sub.items?.data?.[0];
  if (!item) return null;
  const fromPrice = item.price?.unit_amount;
  if (typeof fromPrice === "number") return fromPrice;
  const fromPlan = item.plan?.amount;
  if (typeof fromPlan === "number") return fromPlan;
  return null;
}

function subscriptionPriceId(sub: Stripe.Subscription): string {
  const item = sub.items?.data?.[0];
  return item?.price?.id?.trim() || item?.plan?.id?.trim() || "";
}

/**
 * Résout plan + utilisateur à partir d’un abonnement / facture Stripe
 * (métadonnées nouveau site + legacy `title` / `email`).
 */
export async function resolveStripeSubscriptionContext(
  stripe: Stripe,
  sub: Stripe.Subscription,
  invoice?: Stripe.Invoice | null
): Promise<ResolvedStripeSubscriptionContext> {
  const metaSources: Array<Record<string, unknown> | null | undefined> = [
    sub.metadata,
    invoice?.metadata,
  ];

  let planId = planIdFromStripeMetadata(...metaSources);
  if (!planId) {
    planId = recapPlanIdFromStripePriceId(subscriptionPriceId(sub)) || "";
  }
  if (!planId) {
    planId =
      recapPlanIdFromSubscriptionAmountCents(subscriptionAmountCents(sub)) || "";
  }

  const firebaseUid = firebaseUidFromStripeMetadata(...metaSources);

  let customerEmail =
    invoice?.customer_email?.trim().toLowerCase() ||
    emailFromStripeMetadata(...metaSources);

  if (!customerEmail) {
    const customerId =
      typeof sub.customer === "string"
        ? sub.customer
        : sub.customer && typeof sub.customer === "object" && "id" in sub.customer
          ? String(sub.customer.id)
          : typeof invoice?.customer === "string"
            ? invoice.customer
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

  return { planId, firebaseUid, customerEmail };
}
