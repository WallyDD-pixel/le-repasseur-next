import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import * as admin from "firebase-admin";

import { TRANSACTIONS_COLLECTION } from "@/lib/activiteAdmin";
import { isSubscriptionRecapPlan } from "@/lib/stripePlans";
import { getAdminFirestore, getFirebaseAdminApp } from "@/server/firebaseAdmin";
import { verifyFirebaseUserIdToken } from "@/server/firebaseIdTokenVerify";
import { resolveStripeSecret } from "@/server/stripeConfigResolve";
import {
  stripeCustomerIdFromCheckoutSession,
  stripeSubscriptionIdFromCheckoutSession,
} from "@/server/checkoutStripeCustomer";
import {
  applyStripeCreditsIdempotent,
  planIdFromCheckoutSession,
} from "@/server/stripeCreditsApply";
import { persistUserStripeIds } from "@/server/persistUserStripeIds";
import {
  fetchStripeInvoiceUrls,
  invoiceUrlFields,
} from "@/server/stripeInvoiceUrls";

function readString(body: unknown, key: string): string {
  if (typeof body !== "object" || body === null) return "";
  const raw = (body as Record<string, unknown>)[key];
  return typeof raw === "string" ? raw.trim() : "";
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const sessionId = readString(body, "sessionId");
  const idToken = readString(body, "idToken");

  if (!sessionId || !sessionId.startsWith("cs_")) {
    return NextResponse.json({ error: "sessionId manquant." }, { status: 400 });
  }

  if (!getFirebaseAdminApp()) {
    return NextResponse.json(
      {
        error:
          "Serveur non configuré : FIREBASE_SERVICE_ACCOUNT_JSON requis pour confirmer le paiement et mettre à jour l’abonnement.",
      },
      { status: 503 }
    );
  }

  const user = idToken ? await verifyFirebaseUserIdToken(idToken) : null;
  if (!user) {
    return NextResponse.json(
      { error: "Connexion requise pour confirmer le paiement." },
      { status: 401 }
    );
  }

  const secret = await resolveStripeSecret();
  if (!secret) {
    return NextResponse.json(
      { error: "Clé Stripe introuvable côté serveur." },
      { status: 503 }
    );
  }

  const stripe = new Stripe(secret);

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent", "subscription"],
    });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Impossible de récupérer la session Stripe.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  if (session.client_reference_id && session.client_reference_id !== user.uid) {
    return NextResponse.json(
      { error: "Session Stripe ne correspond pas à votre compte." },
      { status: 403 }
    );
  }

  const planId = planIdFromCheckoutSession(session);
  const paid = session.payment_status === "paid";
  if (!paid) {
    return NextResponse.json(
      { error: "Paiement non confirmé (statut Stripe ≠ paid)." },
      { status: 409 }
    );
  }

  const db = getAdminFirestore();
  if (!db) {
    return NextResponse.json(
      { error: "Firestore Admin indisponible." },
      { status: 503 }
    );
  }

  if (!planId) {
    return NextResponse.json(
      { error: "planId manquant dans la session Stripe." },
      { status: 400 }
    );
  }

  const isSub = isSubscriptionRecapPlan(planId);
  const amountTotal =
    typeof session.amount_total === "number" ? session.amount_total : null;
  const amountEuros =
    amountTotal != null ? Math.round((amountTotal / 100) * 100) / 100 : null;

  const stripeSubscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  const stripeInvoiceId =
    typeof session.invoice === "string" ? session.invoice : undefined;

  const txPayload: Record<string, unknown> = {
    userId: user.uid,
    type: isSub ? "abonnement" : "paiement",
    titre: `Formule ${planId}`,
    stripeCheckoutSessionId: session.id,
    transactionDate: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    source: "checkout_confirm",
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

  try {
    const result = await applyStripeCreditsIdempotent(db, {
      uid: user.uid,
      txDocId: session.id,
      planId,
      amountEuros,
      txPayload,
      setRole: isSub,
    });

    await persistUserStripeIds(db, user.uid, {
      stripeCustomerId: stripeCustomerIdFromCheckoutSession(session),
      stripeSubscriptionId:
        stripeSubscriptionIdFromCheckoutSession(session) ?? stripeSubscriptionId,
    });

    return NextResponse.json({
      ok: true,
      paid: true,
      planId,
      subscriptionActivated: Boolean(isSub && planId),
      creditsApplied: result.credits,
      idempotent: result.idempotent,
    });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Écriture Firestore impossible.";
    console.error("[checkout/confirm]", msg, e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
