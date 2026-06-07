import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";

import { syncStripeSubscribers } from "@/lib/syncStripeSubscribers";
import { requireAdminApiUser } from "@/server/adminApiRouteAuth";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import { resolveStripeSecret } from "@/server/stripeConfigResolve";

export const runtime = "nodejs";

function readBool(body: unknown, key: string, fallback: boolean): boolean {
  if (typeof body !== "object" || body === null) return fallback;
  const v = (body as Record<string, unknown>)[key];
  return typeof v === "boolean" ? v : fallback;
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminApiUser(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    /* corps vide OK */
  }

  const dryRun = readBool(body, "dryRun", true);
  const setQuotas = readBool(body, "setQuotas", false);

  const secret = await resolveStripeSecret();
  if (!secret) {
    return NextResponse.json(
      { error: "Clé Stripe introuvable (Firestore ou STRIPE_SECRET_KEY)." },
      { status: 503 }
    );
  }

  const db = getAdminFirestore();
  if (!db) {
    return NextResponse.json(
      { error: "Firestore Admin indisponible (FIREBASE_SERVICE_ACCOUNT_JSON)." },
      { status: 503 }
    );
  }

  const stripe = new Stripe(secret);
  const result = await syncStripeSubscribers(stripe, db, { dryRun, setQuotas });

  return NextResponse.json(result);
}
