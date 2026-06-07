import type Stripe from "stripe";

const ACTIVE_SUBSCRIPTION_STATUSES = [
  "active",
  "trialing",
  "past_due",
] as const satisfies readonly Stripe.SubscriptionListParams["status"][];

export type CheckoutStripeUserContext = {
  uid: string;
  email?: string;
  name?: string;
  storedCustomerId?: string;
};

function isStripeCustomerId(value: string | undefined): value is string {
  return typeof value === "string" && value.startsWith("cus_");
}

/** Tous les clients Stripe susceptibles d’appartenir à l’utilisateur. */
export async function listStripeCustomerIdsForUser(
  stripe: Stripe,
  params: CheckoutStripeUserContext
): Promise<string[]> {
  const ids = new Set<string>();
  if (isStripeCustomerId(params.storedCustomerId)) {
    ids.add(params.storedCustomerId);
  }

  const email = params.email?.trim().toLowerCase();
  if (email) {
    const listed = await stripe.customers.list({ email, limit: 20 });
    for (const customer of listed.data) ids.add(customer.id);
  }

  try {
    const found = await stripe.customers.search({
      query: `metadata['firebaseUid']:'${params.uid}'`,
      limit: 20,
    });
    for (const customer of found.data) ids.add(customer.id);
  } catch {
    /* Customer Search indisponible sur certains comptes */
  }

  return [...ids];
}

async function subscriptionsByUidMetadata(
  stripe: Stripe,
  uid: string,
  status: (typeof ACTIVE_SUBSCRIPTION_STATUSES)[number]
): Promise<Stripe.Subscription[]> {
  try {
    const result = await stripe.subscriptions.search({
      query: `metadata['firebaseUid']:'${uid}' AND status:'${status}'`,
      limit: 10,
    });
    return result.data;
  } catch {
    return [];
  }
}

/** Vrai si l’utilisateur a déjà un abonnement Stripe actif (ou en essai / impayé récent). */
export async function userHasActiveStripeSubscription(
  stripe: Stripe,
  params: CheckoutStripeUserContext
): Promise<{ active: boolean; subscriptionId?: string }> {
  for (const status of ACTIVE_SUBSCRIPTION_STATUSES) {
    const byMeta = await subscriptionsByUidMetadata(stripe, params.uid, status);
    if (byMeta.length > 0) {
      return { active: true, subscriptionId: byMeta[0]!.id };
    }
  }

  const customerIds = await listStripeCustomerIdsForUser(stripe, params);
  for (const customerId of customerIds) {
    for (const status of ACTIVE_SUBSCRIPTION_STATUSES) {
      const subs = await stripe.subscriptions.list({
        customer: customerId,
        status,
        limit: 5,
      });
      if (subs.data.length > 0) {
        return { active: true, subscriptionId: subs.data[0]!.id };
      }
    }
  }

  return { active: false };
}

/** Choisit le client Stripe à réutiliser pour un nouveau Checkout. */
export async function resolveStripeCustomerIdForCheckout(
  stripe: Stripe,
  params: CheckoutStripeUserContext
): Promise<string | null> {
  const customerIds = await listStripeCustomerIdsForUser(stripe, params);
  if (customerIds.length === 0) return null;

  if (
    isStripeCustomerId(params.storedCustomerId) &&
    customerIds.includes(params.storedCustomerId)
  ) {
    return params.storedCustomerId;
  }

  type Candidate = { id: string; created: number; uidMatch: boolean; hasActiveSub: boolean };
  const candidates: Candidate[] = [];

  for (const id of customerIds) {
    const customer = await stripe.customers.retrieve(id);
    if (customer.deleted) continue;

    const uidMatch = customer.metadata?.firebaseUid === params.uid;
    const activeSubs = await stripe.subscriptions.list({
      customer: id,
      status: "active",
      limit: 1,
    });

    candidates.push({
      id,
      created: customer.created,
      uidMatch,
      hasActiveSub: activeSubs.data.length > 0,
    });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (a.uidMatch !== b.uidMatch) return a.uidMatch ? -1 : 1;
    if (a.hasActiveSub !== b.hasActiveSub) return a.hasActiveSub ? -1 : 1;
    return b.created - a.created;
  });

  return candidates[0]!.id;
}

/** Lie le client Stripe au compte Firebase (métadonnées + e-mail si absent). */
export async function ensureStripeCustomerLinked(
  stripe: Stripe,
  customerId: string,
  params: CheckoutStripeUserContext
): Promise<void> {
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) return;

  const updates: Stripe.CustomerUpdateParams = {};
  if (customer.metadata?.firebaseUid !== params.uid) {
    updates.metadata = { ...customer.metadata, firebaseUid: params.uid };
  }
  const email = params.email?.trim();
  if (email && !customer.email) {
    updates.email = email;
  }
  if (params.name?.trim() && !customer.name) {
    updates.name = params.name.trim();
  }

  if (Object.keys(updates).length > 0) {
    await stripe.customers.update(customerId, updates);
  }
}

export function stripeCustomerIdFromCheckoutSession(
  session: Stripe.Checkout.Session
): string | undefined {
  if (typeof session.customer === "string" && session.customer.startsWith("cus_")) {
    return session.customer;
  }
  if (
    session.customer &&
    typeof session.customer === "object" &&
    "id" in session.customer &&
    typeof session.customer.id === "string"
  ) {
    return session.customer.id;
  }
  return undefined;
}

export function stripeSubscriptionIdFromCheckoutSession(
  session: Stripe.Checkout.Session
): string | undefined {
  if (
    typeof session.subscription === "string" &&
    session.subscription.startsWith("sub_")
  ) {
    return session.subscription;
  }
  if (
    session.subscription &&
    typeof session.subscription === "object" &&
    "id" in session.subscription &&
    typeof session.subscription.id === "string"
  ) {
    return session.subscription.id;
  }
  return undefined;
}
