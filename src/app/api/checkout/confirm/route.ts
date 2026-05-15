import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import * as admin from "firebase-admin";

import { TRANSACTIONS_COLLECTION } from "@/lib/activiteAdmin";
import { isSubscriptionRecapPlan } from "@/lib/stripePlans";
import { getAdminFirestore, getFirebaseAdminApp } from "@/server/firebaseAdmin";
import { verifyFirebaseUserIdToken } from "@/server/firebaseIdTokenVerify";
import { resolveStripeSecret } from "@/server/stripeConfigResolve";

function readString(body: unknown, key: string): string {
  if (typeof body !== "object" || body === null) return "";
  const raw = (body as Record<string, unknown>)[key];
  return typeof raw === "string" ? raw.trim() : "";
}

function readPositiveNumber(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw === "string") {
    const n = Number.parseFloat(raw.replace(",", ".").trim());
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

async function findPlanOrProductData(
  db: admin.firestore.Firestore,
  planId: string,
  amountEuros: number | null
): Promise<Record<string, unknown>> {
  if (!planId && amountEuros == null) return {};

  // 1) Formules abonnement (id == planId)
  if (planId) {
    const a = await db.collection("abonnements").doc(planId).get();
    if (a.exists) return a.data() as Record<string, unknown>;
  }

  // 2) Produits : id == planId
  if (planId) {
    const p = await db.collection("produits").doc(planId).get();
    if (p.exists) return p.data() as Record<string, unknown>;
  }

  // 3) Produits : nom / recapPlanId == planId
  if (planId) {
    const byNom = await db
      .collection("produits")
      .where("nom", "==", planId)
      .limit(1)
      .get();
    if (!byNom.empty) return byNom.docs[0]!.data() as Record<string, unknown>;

    const byRecap = await db
      .collection("produits")
      .where("recapPlanId", "==", planId)
      .limit(1)
      .get();
    if (!byRecap.empty) return byRecap.docs[0]!.data() as Record<string, unknown>;
  }

  // 4) Heuristique par prix (utile quand planId est "Pack 5 kg" mais doc legacy diffère).
  if (amountEuros != null) {
    const all = await db.collection("produits").get();
    for (const d of all.docs) {
      const data = d.data() as Record<string, unknown>;
      const p = readPositiveNumber(data.prix ?? data.price);
      if (p != null && Math.abs(p - amountEuros) < 0.001) {
        return data;
      }
    }
  }

  return {};
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

  // Sécurité : la session doit correspondre à l'utilisateur (uid).
  if (session.client_reference_id && session.client_reference_id !== user.uid) {
    return NextResponse.json(
      { error: "Session Stripe ne correspond pas à votre compte." },
      { status: 403 }
    );
  }

  const planId = session.metadata?.planId?.trim() || "";
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

  const isSub = planId ? isSubscriptionRecapPlan(planId) : false;

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
    titre: planId ? `Formule ${planId}` : "Paiement",
    stripeCheckoutSessionId: session.id,
    transactionDate: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (planId) txPayload.role = planId;
  if (amountEuros != null) txPayload.montant = amountEuros;
  if (session.currency) txPayload.currency = session.currency;
  if (stripeSubscriptionId) txPayload.stripeSubscriptionId = stripeSubscriptionId;
  if (stripeInvoiceId) txPayload.stripeInvoiceId = stripeInvoiceId;

  try {
    const txRef = db.collection(TRANSACTIONS_COLLECTION).doc(session.id);
    const txSnap = await txRef.get();
    const firstConfirmation = !txSnap.exists;

    // Idempotence simple : docId = session.id
    await txRef.set(txPayload, { merge: true });

    if (planId) {
      const userRef = db.collection("users").doc(user.uid);
      const updates: Record<string, unknown> = {
        ...(isSub ? { role: planId } : {}),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // Métier demandé:
      // - collectes/collecte => users.reservations
      // - kg                => users.collectes
      if (firstConfirmation) {
        const planData = await findPlanOrProductData(db, planId, amountEuros);

        const collectes = readPositiveNumber(
          planData.collectes ?? planData.collecte
        );
        const kg = readPositiveNumber(planData.kg);

        if (collectes != null) {
          updates.reservations = admin.firestore.FieldValue.increment(collectes);
        }
        if (kg != null) updates.collectes = admin.firestore.FieldValue.increment(kg);
      }

      await userRef.set(updates, { merge: true });
    }
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Écriture Firestore impossible.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    paid: true,
    planId: planId || null,
    subscriptionActivated: Boolean(isSub && planId),
  });
}

