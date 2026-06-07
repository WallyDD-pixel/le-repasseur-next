import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import * as admin from "firebase-admin";

import { TRANSACTIONS_COLLECTION } from "@/lib/activiteAdmin";
import { resolveStripeSubscriptionContext } from "@/lib/stripeSubscriptionResolve";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import { resolveStripeSecret } from "@/server/stripeConfigResolve";
import {
  fetchStripeInvoiceUrls,
  invoiceUrlFields,
  urlsFromStripeInvoice,
} from "@/server/stripeInvoiceUrls";
import {
  stripeCustomerIdFromCheckoutSession,
  stripeSubscriptionIdFromCheckoutSession,
} from "@/server/checkoutStripeCustomer";
import {
  applyStripeCreditsIdempotent,
  planIdFromCheckoutSession,
  resolveInvoiceRenewalContext,
  subscriptionIdFromInvoice,
} from "@/server/stripeCreditsApply";
import { persistUserStripeIds } from "@/server/persistUserStripeIds";
import { syncSubscriptionPriceBeforeRenewal } from "@/server/stripeSubscriptionPromoPrice";
import { isSubscriptionRecapPlan } from "@/lib/stripePlans";

export const runtime = "nodejs";

async function uidFromEmail(
  db: admin.firestore.Firestore,
  email: string
): Promise<string | null> {
  const t = email.trim();
  if (!t) return null;
  const q = await db.collection("users").where("email", "==", t).limit(1).get();
  if (q.empty) return null;
  return q.docs[0]!.id;
}

async function resolveUidForCheckoutSession(
  db: admin.firestore.Firestore,
  session: Stripe.Checkout.Session
): Promise<string | null> {
  const fromRef = session.client_reference_id?.trim();
  if (fromRef) return fromRef;

  const fromMeta =
    typeof session.metadata?.firebaseUid === "string"
      ? session.metadata.firebaseUid.trim()
      : "";
  if (fromMeta) return fromMeta;

  const email =
    session.customer_details?.email?.trim().toLowerCase() ||
    (typeof session.customer_email === "string"
      ? session.customer_email.trim().toLowerCase()
      : "");
  if (email) return uidFromEmail(db, email);
  return null;
}

async function handleCheckoutSessionCompleted(
  db: admin.firestore.Firestore,
  stripe: Stripe,
  session: Stripe.Checkout.Session
) {
  if (session.payment_status !== "paid") {
    return NextResponse.json({
      ok: true,
      ignored: `payment_status:${session.payment_status}`,
    });
  }

  const uid = await resolveUidForCheckoutSession(db, session);
  if (!uid) {
    return NextResponse.json(
      { error: "Impossible d’identifier l’utilisateur (checkout)." },
      { status: 409 }
    );
  }

  const planId = planIdFromCheckoutSession(session);
  if (!planId) {
    return NextResponse.json(
      { error: "planId manquant dans les métadonnées checkout." },
      { status: 400 }
    );
  }

  const amountTotal =
    typeof session.amount_total === "number" ? session.amount_total : null;
  const amountEuros =
    amountTotal != null ? Math.round((amountTotal / 100) * 100) / 100 : null;

  const isSub = isSubscriptionRecapPlan(planId);
  const stripeSubscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;
  const stripeInvoiceId =
    typeof session.invoice === "string" ? session.invoice : undefined;

  const txPayload: Record<string, unknown> = {
    userId: uid,
    type: isSub ? "abonnement" : "paiement",
    titre: `Formule ${planId}`,
    stripeCheckoutSessionId: session.id,
    transactionDate: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    source: "stripe_webhook",
    role: planId,
  };
  if (amountEuros != null) txPayload.montant = amountEuros;
  if (session.currency) txPayload.currency = session.currency;
  if (stripeSubscriptionId) txPayload.stripeSubscriptionId = stripeSubscriptionId;
  if (stripeInvoiceId) {
    txPayload.stripeInvoiceId = stripeInvoiceId;
    try {
      const urls = await fetchStripeInvoiceUrls(stripe, stripeInvoiceId);
      Object.assign(txPayload, invoiceUrlFields(urls));
    } catch {
      /* ignore */
    }
  }

  const result = await applyStripeCreditsIdempotent(db, {
    uid,
    txDocId: session.id,
    planId,
    amountEuros,
    txPayload,
    setRole: isSub,
  });

  await persistUserStripeIds(db, uid, {
    stripeCustomerId: stripeCustomerIdFromCheckoutSession(session),
    stripeSubscriptionId:
      stripeSubscriptionIdFromCheckoutSession(session) ?? stripeSubscriptionId,
  });

  return NextResponse.json({
    ok: true,
    checkout: true,
    uid,
    ...result,
  });
}

async function handleInvoiceUpcoming(
  stripe: Stripe,
  db: admin.firestore.Firestore,
  invoice: Stripe.Invoice
) {
  const subId = subscriptionIdFromInvoice(invoice);
  if (!subId) {
    return NextResponse.json({ ok: true, ignored: "no_subscription" });
  }

  let sub: Stripe.Subscription;
  try {
    sub = await stripe.subscriptions.retrieve(subId, {
      expand: ["items.data.price.product"],
    });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Impossible de récupérer l’abonnement.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const { firebaseUid, customerEmail } = await resolveStripeSubscriptionContext(
    stripe,
    sub,
    invoice
  );

  let uid = firebaseUid;
  if (!uid && customerEmail) {
    uid = (await uidFromEmail(db, customerEmail)) || "";
  }
  if (!uid) {
    return NextResponse.json({ ok: true, ignored: "user_not_found" });
  }

  const sync = await syncSubscriptionPriceBeforeRenewal({
    stripe,
    db,
    subscription: sub,
    uid,
  });

  return NextResponse.json({ ok: true, priceSync: sync });
}

async function handleInvoicePaidRenewal(
  db: admin.firestore.Firestore,
  stripe: Stripe,
  invoice: Stripe.Invoice
) {
  if (invoice.billing_reason !== "subscription_cycle") {
    return NextResponse.json({
      ok: true,
      ignored: invoice.billing_reason || "n/a",
    });
  }

  const invoiceId = invoice.id;

  const txRef = db.collection(TRANSACTIONS_COLLECTION).doc(`inv_${invoiceId}`);
  const txSnap = await txRef.get();
  if (txSnap.exists && txSnap.data()?.creditsApplied === true) {
    return NextResponse.json({ ok: true, idempotent: true });
  }

  const {
    planId,
    firebaseUid,
    customerEmail,
    subscriptionId: subId,
    usedInvoiceFallback,
  } = await resolveInvoiceRenewalContext(stripe, invoice);

  let uid = firebaseUid;
  if (!uid && customerEmail) {
    uid = (await uidFromEmail(db, customerEmail)) || "";
  }
  if (!uid) {
    return NextResponse.json(
      {
        error: `Impossible d’identifier l’utilisateur Firestore (email: ${customerEmail || "absent"}).`,
      },
      { status: 409 }
    );
  }

  if (!planId) {
    return NextResponse.json(
      {
        error:
          "Formule introuvable sur la facture (métadonnées title/planId, prix ou montant).",
      },
      { status: 400 }
    );
  }

  const amountTotal =
    typeof invoice.amount_paid === "number" ? invoice.amount_paid : null;
  const amountEuros =
    amountTotal != null ? Math.round((amountTotal / 100) * 100) / 100 : null;

  const txPayload: Record<string, unknown> = {
    userId: uid,
    type: "renouvellement",
    titre: `Renouvellement ${planId}`,
    stripeInvoiceId: invoiceId,
    stripeSubscriptionId: subId,
    transactionDate: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    source: "stripe_webhook",
    role: planId,
  };
  if (amountEuros != null) txPayload.montant = amountEuros;
  if (invoice.currency) txPayload.currency = invoice.currency;
  Object.assign(txPayload, invoiceUrlFields(urlsFromStripeInvoice(invoice)));
  if (invoice.number) txPayload.invoiceNumber = invoice.number;

  const result = await applyStripeCreditsIdempotent(db, {
    uid,
    txDocId: `inv_${invoiceId}`,
    planId,
    amountEuros,
    txPayload,
    setRole: true,
  });

  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer && typeof invoice.customer === "object"
        ? invoice.customer.id
        : undefined;

  await persistUserStripeIds(db, uid, {
    stripeCustomerId: customerId,
    stripeSubscriptionId: subId,
  });

  return NextResponse.json({
    ok: true,
    renewed: true,
    uid,
    planId,
    credits: result.credits,
    idempotent: result.idempotent,
    usedInvoiceFallback,
  });
}

export async function POST(req: NextRequest) {
  const secretKey = await resolveStripeSecret();
  if (!secretKey) {
    return NextResponse.json(
      { error: "STRIPE secret key introuvable." },
      { status: 503 }
    );
  }
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET manquant." },
      { status: 503 }
    );
  }

  const db = getAdminFirestore();
  if (!db) {
    return NextResponse.json(
      { error: "Firestore Admin indisponible." },
      { status: 503 }
    );
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json(
      { error: "En-tête stripe-signature manquant." },
      { status: 400 }
    );
  }

  const rawBody = await req.text();
  const stripe = new Stripe(secretKey);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Signature webhook invalide.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    return handleCheckoutSessionCompleted(
      db,
      stripe,
      event.data.object as Stripe.Checkout.Session
    );
  }

  if (event.type === "invoice.upcoming") {
    return handleInvoiceUpcoming(
      stripe,
      db,
      event.data.object as Stripe.Invoice
    );
  }

  if (event.type === "invoice.paid") {
    return handleInvoicePaidRenewal(
      db,
      stripe,
      event.data.object as Stripe.Invoice
    );
  }

  return NextResponse.json({ ok: true, ignored: event.type });
}
