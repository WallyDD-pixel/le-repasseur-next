import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { getCatalogEntryByRecapPlanId, getLegacyRecapUrl } from "@/lib/clientCatalog";
import {
  isCheckoutPlanId,
  isSubscriptionRecapPlan,
  stripePriceEnvVarNameForPlan,
} from "@/lib/stripePlans";
import { getAdminFirestore, getFirebaseAdminApp } from "@/server/firebaseAdmin";
import { resolveCheckoutEuroCents } from "@/server/checkoutEuroCentsResolve";
import { verifyFirebaseUserIdToken } from "@/server/firebaseIdTokenVerify";
import {
  resolveStripePriceId,
  resolveStripeSecret,
} from "@/server/stripeConfigResolve";

/** Montant minimal facturable Stripe en EUR pour `unit_amount` (souvent 0,50 €). */
const STRIPE_MIN_EUR_UNIT_CENTS = 50;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const planId =
    typeof body === "object" &&
    body !== null &&
    "planId" in body &&
    typeof (body as { planId: unknown }).planId === "string"
      ? (body as { planId: string }).planId.trim()
      : "";

  if (!planId || !isCheckoutPlanId(planId)) {
    return NextResponse.json({ error: "Offre non reconnue." }, { status: 400 });
  }

  const idTokenRaw =
    typeof body === "object" &&
    body !== null &&
    "idToken" in body &&
    typeof (body as { idToken: unknown }).idToken === "string"
      ? (body as { idToken: string }).idToken.trim()
      : "";

  const firebaseUser = idTokenRaw
    ? await verifyFirebaseUserIdToken(idTokenRaw)
    : null;

  if (getFirebaseAdminApp() && !firebaseUser) {
    return NextResponse.json(
      {
        error:
          "Connexion obligatoire pour payer. Connectez-vous à votre espace client puis réessayez.",
      },
      { status: 401 }
    );
  }

  const secret = await resolveStripeSecret();
  const priceId = await resolveStripePriceId(planId);
  const euroCents =
    typeof priceId === "string" && priceId.trim()
      ? undefined
      : await resolveCheckoutEuroCents(planId);

  const hasStripePrice = Boolean(priceId?.trim());
  const hasDynamicAmount =
    typeof euroCents === "number" &&
    euroCents >= STRIPE_MIN_EUR_UNIT_CENTS;

  if (!secret || (!hasStripePrice && !hasDynamicAmount)) {
    if (process.env.CHECKOUT_LEGACY_FALLBACK === "1") {
      return NextResponse.json({
        legacyUrl: getLegacyRecapUrl(planId),
      });
    }

    const serverReadsFirestore = getAdminFirestore() !== null;
    const envHint = stripePriceEnvVarNameForPlan(planId);
    const messages: string[] = [];

    if (!secret) {
      messages.push(
        serverReadsFirestore
          ? "Clé secrète Stripe introuvable : renseignez-la dans Administration → Stripe (Firestore) ou la variable STRIPE_SECRET_KEY dans le .env utilisé par Next.js."
          : "Clé secrète Stripe introuvable : le navigateur peut enregistrer les clés dans Firestore, mais l’API de paiement tourne sur le serveur. Ajoutez STRIPE_SECRET_KEY dans le fichier .env (dev / prod) ou définissez FIREBASE_SERVICE_ACCOUNT_JSON pour que le serveur puisse lire siteSettings/stripe."
      );
    }

    if (!hasStripePrice && !hasDynamicAmount) {
      const prixVar = envHint
        ? `ex. ${envHint}=price_xxx dans .env`
        : "STRIPE_PRICE_* correspondant au plan dans .env";
      messages.push(
        `Tarif introuvable pour « ${planId} » : sans identifiant Stripe price_…, le montant doit venir du catalogue du site ou du champ prix des fiches abonnements/produits. En secours vous pouvez utiliser ${prixVar}.`
      );
    }

    return NextResponse.json(
      { error: messages.join(" ") },
      { status: 503 }
    );
  }

  const stripe = new Stripe(secret);
  const originHeader = req.headers.get("origin");
  let origin = originHeader ?? req.nextUrl.origin;
  if (!originHeader) {
    const referer = req.headers.get("referer");
    if (referer) {
      try {
        origin = new URL(referer).origin;
      } catch {
        /* garde req.nextUrl.origin */
      }
    }
  }

  const mode = isSubscriptionRecapPlan(planId) ? "subscription" : "payment";
  const catalogEntry = getCatalogEntryByRecapPlanId(planId);
  const productName = catalogEntry?.name ?? planId;

  const lineItem = hasStripePrice
    ? ({ price: priceId!.trim(), quantity: 1 } as const)
    : {
        quantity: 1,
        price_data: {
          currency: "eur" as const,
          unit_amount: euroCents!,
          product_data: {
            name: productName,
          },
          ...(mode === "subscription"
            ? ({ recurring: { interval: "month" as const } } as const)
            : {}),
        },
      };

  const extraMeta: Record<string, string> = { planId };
  if (firebaseUser?.uid) extraMeta.firebaseUid = firebaseUser.uid;
  if (firebaseUser?.email) extraMeta.userEmail = firebaseUser.email;
  if (firebaseUser?.name) extraMeta.userName = firebaseUser.name;

  const sessionStripe: Stripe.Checkout.SessionCreateParams = {
    mode,
    line_items: [lineItem],
    success_url: `${origin}/espace-client?checkout=success&plan=${encodeURIComponent(planId)}`,
    cancel_url: `${origin}/espace-client/recap?plan=${encodeURIComponent(planId)}&checkout=cancel`,
    metadata: extraMeta,
    ...(firebaseUser?.uid
      ? {
          client_reference_id: firebaseUser.uid,
          ...(firebaseUser.email ? { customer_email: firebaseUser.email } : {}),
        }
      : {}),
    ...(mode === "subscription"
      ? {
          subscription_data: {
            metadata: { ...extraMeta },
          },
        }
      : {
          payment_intent_data: {
            metadata: { ...extraMeta },
          },
        }),
  };

  try {
    const session = await stripe.checkout.sessions.create(sessionStripe);

    if (!session.url) {
      return NextResponse.json(
        { error: "Session Stripe sans URL de redirection." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Erreur lors de la création de la session.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
