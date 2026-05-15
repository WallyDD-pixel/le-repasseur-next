import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import * as admin from "firebase-admin";

import { TRANSACTIONS_COLLECTION } from "@/lib/activiteAdmin";
import { getAdminFirestore, getFirebaseAdminApp } from "@/server/firebaseAdmin";
import { verifyFirebaseUserIdToken } from "@/server/firebaseIdTokenVerify";
import { resolveStripeSecret } from "@/server/stripeConfigResolve";

function readString(body: unknown, key: string): string {
  if (typeof body !== "object" || body === null) return "";
  const raw = (body as Record<string, unknown>)[key];
  return typeof raw === "string" ? raw.trim() : "";
}

function tsMs(raw: unknown): number {
  if (raw && typeof raw === "object" && "toDate" in raw) {
    try {
      return (raw as { toDate: () => Date }).toDate().getTime();
    } catch {
      return 0;
    }
  }
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const n = Date.parse(raw);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

async function latestSubscriptionId(
  db: admin.firestore.Firestore,
  uid: string
): Promise<string | null> {
  const snap = await db
    .collection(TRANSACTIONS_COLLECTION)
    .where("userId", "==", uid)
    .get();
  let bestSubId = "";
  let bestDateMs = -1;
  snap.forEach((d) => {
    const data = d.data() as Record<string, unknown>;
    const subId =
      typeof data.stripeSubscriptionId === "string"
        ? data.stripeSubscriptionId.trim()
        : "";
    if (!subId) return;
    const dateMs = tsMs(data.transactionDate) || tsMs(data.createdAt);
    if (dateMs > bestDateMs) {
      bestDateMs = dateMs;
      bestSubId = subId;
    }
  });
  return bestSubId || null;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  if (!getFirebaseAdminApp()) {
    return NextResponse.json(
      {
        error:
          "Serveur non configuré : FIREBASE_SERVICE_ACCOUNT_JSON requis pour ouvrir le portail Stripe.",
      },
      { status: 503 }
    );
  }

  const idToken = readString(body, "idToken");
  const user = idToken ? await verifyFirebaseUserIdToken(idToken) : null;
  if (!user) {
    return NextResponse.json(
      { error: "Connexion requise pour accéder au portail Stripe." },
      { status: 401 }
    );
  }

  const db = getAdminFirestore();
  if (!db) {
    return NextResponse.json(
      { error: "Firestore Admin indisponible." },
      { status: 503 }
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

  const subId = await latestSubscriptionId(db, user.uid);
  if (!subId) {
    return NextResponse.json(
      { error: "Aucun abonnement Stripe lié à ce compte." },
      { status: 404 }
    );
  }

  let sub: Stripe.Subscription;
  try {
    sub = await stripe.subscriptions.retrieve(subId);
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Impossible de récupérer l’abonnement Stripe.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (!customerId) {
    return NextResponse.json(
      { error: "Client Stripe introuvable sur cet abonnement." },
      { status: 409 }
    );
  }

  const returnUrl =
    readString(body, "returnUrl") ||
    process.env.STRIPE_BILLING_PORTAL_RETURN_URL?.trim() ||
    `${req.nextUrl.origin}/espace-client`;

  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return NextResponse.json({ ok: true, url: portal.url });
  } catch (e) {
    const msg =
      e instanceof Error
        ? e.message
        : "Impossible de créer la session Stripe Customer Portal.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

