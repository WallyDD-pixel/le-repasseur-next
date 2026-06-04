import "server-only";

import type Stripe from "stripe";

import { isSubscriptionRecapPlan } from "@/lib/stripePlans";
import { applyPromoPercentToCents, parseUserPromoPercents } from "@/lib/userPromo";
import { resolveCheckoutEuroCents } from "@/server/checkoutEuroCentsResolve";
import type * as admin from "firebase-admin";

const STRIPE_MIN_EUR_UNIT_CENTS = 50;

function subscriptionItemProductId(
  item: Stripe.SubscriptionItem
): string | undefined {
  const price = item.price;
  if (!price) return undefined;
  const product = price.product;
  if (typeof product === "string" && product.startsWith("prod_")) return product;
  if (product && typeof product === "object" && "id" in product) {
    const id = (product as { id?: string }).id;
    if (typeof id === "string" && id.startsWith("prod_")) return id;
  }
  return undefined;
}

/**
 * Avant le prochain prélèvement : aligne le montant Stripe sur catalogue × promo utilisateur.
 */
export async function syncSubscriptionPriceBeforeRenewal(params: {
  stripe: Stripe;
  db: admin.firestore.Firestore;
  subscription: Stripe.Subscription;
  uid: string;
}): Promise<{ updated: boolean; reason?: string; cents?: number }> {
  const { stripe, db, subscription, uid } = params;
  const item = subscription.items?.data?.[0];
  if (!item?.id) {
    return { updated: false, reason: "subscription_item_missing" };
  }

  const meta = subscription.metadata ?? {};
  const planId =
    (typeof meta.planId === "string" && meta.planId.trim()) ||
    (typeof meta.plan_id === "string" && meta.plan_id.trim()) ||
    "";

  if (!planId || !isSubscriptionRecapPlan(planId)) {
    return { updated: false, reason: "not_subscription_plan" };
  }

  const userSnap = await db.collection("users").doc(uid).get();
  const promos = parseUserPromoPercents(
    userSnap.exists ? (userSnap.data() as Record<string, unknown>) : {}
  );
  const promoPercent = promos.abonnement;

  const baseCents = await resolveCheckoutEuroCents(planId);
  if (baseCents == null || baseCents < STRIPE_MIN_EUR_UNIT_CENTS) {
    return { updated: false, reason: "catalog_amount_unavailable" };
  }

  const targetCents = applyPromoPercentToCents(baseCents, promoPercent);
  if (targetCents < STRIPE_MIN_EUR_UNIT_CENTS) {
    return { updated: false, reason: "amount_below_stripe_minimum" };
  }

  const currentCents = item.price?.unit_amount ?? item.plan?.amount ?? null;
  if (currentCents === targetCents) {
    return { updated: false, reason: "already_aligned", cents: targetCents };
  }

  const productId = subscriptionItemProductId(item);
  if (!productId) {
    return { updated: false, reason: "product_id_missing" };
  }

  await stripe.subscriptions.update(subscription.id, {
    items: [
      {
        id: item.id,
        price_data: {
          currency: "eur",
          unit_amount: targetCents,
          product: productId,
          recurring: { interval: "month" },
        },
      },
    ],
    proration_behavior: "none",
    metadata: {
      ...meta,
      planId,
      ...(promoPercent > 0 ? { promoPercentApplied: String(promoPercent) } : {}),
    },
  });

  return { updated: true, cents: targetCents };
}
