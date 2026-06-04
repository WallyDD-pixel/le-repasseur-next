import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import * as admin from "firebase-admin";

import { TRANSACTIONS_COLLECTION } from "@/lib/activiteAdmin";
import {
  findPlanOrProductData,
  resolvePlanCredits,
} from "@/lib/planCreditsResolve";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import { resolveStripeSubscriptionContext } from "@/lib/stripeSubscriptionResolve";
import { syncSubscriptionPriceBeforeRenewal } from "@/server/stripeSubscriptionPromoPrice";
import { resolveStripeSecret } from "@/server/stripeConfigResolve";

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

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | undefined {
  const invoiceLike = invoice as unknown as Record<string, unknown>;
  const invoiceSub = invoiceLike.subscription as string | { id?: string } | undefined;
  if (typeof invoiceSub === "string") return invoiceSub;
  if (typeof invoiceSub?.id === "string") return invoiceSub.id;
  return undefined;
}

async function handleInvoiceUpcoming(
  stripe: Stripe,
  db: admin.firestore.Firestore,
  invoice: Stripe.Invoice
) {
  const subId = invoiceSubscriptionId(invoice);
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

async function handleInvoicePaid(
  stripe: Stripe,
  db: admin.firestore.Firestore,
  invoice: Stripe.Invoice
) {
  if (invoice.billing_reason !== "subscription_cycle") {
    return NextResponse.json({
      ok: true,
      ignored: invoice.billing_reason || "n/a",
    });
  }

  const invoiceId = invoice.id;
  const subId = invoiceSubscriptionId(invoice);
  if (!subId) {
    return NextResponse.json(
      { error: "invoice.subscription manquant." },
      { status: 400 }
    );
  }

  const txRef = db.collection(TRANSACTIONS_COLLECTION).doc(`inv_${invoiceId}`);
  const txSnap = await txRef.get();
  if (txSnap.exists) {
    return NextResponse.json({ ok: true, idempotent: true });
  }

  let sub: Stripe.Subscription;
  try {
    sub = await stripe.subscriptions.retrieve(subId);
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Impossible de récupérer l’abonnement Stripe.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const { planId, firebaseUid, customerEmail } =
    await resolveStripeSubscriptionContext(stripe, sub, invoice);

  let uid = firebaseUid;
  if (!uid && customerEmail) {
    uid = (await uidFromEmail(db, customerEmail)) || "";
  }
  if (!uid) {
    return NextResponse.json(
      { error: "Impossible d’identifier l’utilisateur (uid/email absent)." },
      { status: 409 }
    );
  }

  const amountTotal =
    typeof invoice.amount_paid === "number" ? invoice.amount_paid : null;
  const amountEuros =
    amountTotal != null ? Math.round((amountTotal / 100) * 100) / 100 : null;

  const planDoc = await findPlanOrProductData(db, planId, amountEuros);
  const { addReservations, addKg } = resolvePlanCredits(planId, planDoc);
  const addCollectes = addKg;

  const txPayload: Record<string, unknown> = {
    userId: uid,
    type: "renouvellement",
    titre: planId ? `Renouvellement ${planId}` : "Renouvellement abonnement",
    stripeInvoiceId: invoiceId,
    stripeSubscriptionId: subId,
    transactionDate: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    source: "stripe_webhook",
  };
  if (planId) txPayload.role = planId;
  if (amountEuros != null) txPayload.montant = amountEuros;
  if (invoice.currency) txPayload.currency = invoice.currency;

  const updates: Record<string, unknown> = {
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (planId) updates.role = planId;
  if (addReservations != null) {
    updates.reservations = admin.firestore.FieldValue.increment(addReservations);
  }
  if (addCollectes != null) {
    updates.collectes = admin.firestore.FieldValue.increment(addCollectes);
  }

  const batch = db.batch();
  batch.set(txRef, txPayload, { merge: true });
  batch.set(db.collection("users").doc(uid), updates, { merge: true });
  await batch.commit();

  return NextResponse.json({
    ok: true,
    renewed: true,
    uid,
    planId: planId || null,
    addReservations: addReservations ?? 0,
    addCollectes: addCollectes ?? 0,
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

  if (event.type === "invoice.upcoming") {
    return handleInvoiceUpcoming(
      stripe,
      db,
      event.data.object as Stripe.Invoice
    );
  }

  if (event.type === "invoice.paid") {
    return handleInvoicePaid(stripe, db, event.data.object as Stripe.Invoice);
  }

  return NextResponse.json({ ok: true, ignored: event.type });
}
