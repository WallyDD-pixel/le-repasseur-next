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
      const d = (raw as { toDate: () => Date }).toDate();
      return d.getTime();
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

type TxWithSub = {
  subId: string;
  role: string;
  dateMs: number;
};

async function latestSubscriptionTx(
  db: admin.firestore.Firestore,
  uid: string
): Promise<TxWithSub | null> {
  const snap = await db
    .collection(TRANSACTIONS_COLLECTION)
    .where("userId", "==", uid)
    .get();

  let best: TxWithSub | null = null;
  snap.forEach((d) => {
    const data = d.data() as Record<string, unknown>;
    const subId =
      typeof data.stripeSubscriptionId === "string"
        ? data.stripeSubscriptionId.trim()
        : "";
    if (!subId) return;
    const row: TxWithSub = {
      subId,
      role: typeof data.role === "string" ? data.role.trim() : "",
      dateMs: tsMs(data.transactionDate) || tsMs(data.createdAt),
    };
    if (!best || row.dateMs > best.dateMs) best = row;
  });
  return best;
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
          "Serveur non configuré : FIREBASE_SERVICE_ACCOUNT_JSON requis pour résilier via Stripe.",
      },
      { status: 503 }
    );
  }

  const idToken = readString(body, "idToken");
  const reason = readString(body, "reason");
  const user = idToken ? await verifyFirebaseUserIdToken(idToken) : null;
  if (!user) {
    return NextResponse.json(
      { error: "Connexion requise pour résilier." },
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

  const db = getAdminFirestore();
  if (!db) {
    return NextResponse.json(
      { error: "Firestore Admin indisponible." },
      { status: 503 }
    );
  }

  const latest = await latestSubscriptionTx(db, user.uid);
  if (!latest?.subId) {
    return NextResponse.json(
      { error: "Aucun abonnement Stripe actif trouvé pour ce compte." },
      { status: 404 }
    );
  }

  let sub: Stripe.Subscription;
  try {
    sub = await stripe.subscriptions.retrieve(latest.subId);
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Impossible de récupérer l’abonnement.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  if (sub.status === "canceled") {
    const subLike = sub as unknown as Record<string, unknown>;
    const currentPeriodEnd =
      typeof subLike.current_period_end === "number"
        ? subLike.current_period_end
        : null;
    return NextResponse.json({
      ok: true,
      alreadyCanceled: true,
      cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
      currentPeriodEnd,
    });
  }

  const updated =
    sub.cancel_at_period_end
      ? sub
      : await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true });

  await db.collection("resiliations").add({
    userId: user.uid,
    email: user.email ?? "",
    nom: "",
    prenom: "",
    role: latest.role || "",
    stripeSubscriptionId: sub.id,
    etat: "En attente",
    raison: reason || "Résiliation demandée par le client depuis l’espace client.",
    source: "espace-client",
    dateDemande: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await db
    .collection("users")
    .doc(user.uid)
    .set(
      {
        resiliationDemandee: true,
        resiliationAtPeriodEnd: true,
        stripeSubscriptionId: sub.id,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

  const updatedLike = updated as unknown as Record<string, unknown>;
  const currentPeriodEnd =
    typeof updatedLike.current_period_end === "number"
      ? updatedLike.current_period_end
      : null;

  return NextResponse.json({
    ok: true,
    cancelAtPeriodEnd: Boolean(updated.cancel_at_period_end),
    currentPeriodEnd,
    subscriptionId: updated.id,
  });
}

