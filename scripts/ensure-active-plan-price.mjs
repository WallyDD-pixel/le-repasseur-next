import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import Stripe from "stripe";
import admin from "firebase-admin";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const key = t.slice(0, i).trim();
    const val = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvLocal();
admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
  ),
});
const db = admin.firestore();
const settings = (await db.collection("siteSettings").doc("stripe").get()).data();
const stripe = new Stripe(settings.secretKey.trim());

const PLAN = process.argv[2] || "Solo";
const AMOUNT = PLAN === "Solo" ? 3900 : 1900;

// Produit actif Le Repasseur
const product = await stripe.products.create({
  name: `Abonnement ${PLAN} — Le Repasseur`,
  active: true,
  metadata: { planId: PLAN, recapPlanId: PLAN },
});
const price = await stripe.prices.create({
  product: product.id,
  unit_amount: AMOUNT,
  currency: "eur",
  recurring: { interval: "month" },
  nickname: PLAN,
  metadata: { planId: PLAN, recapPlanId: PLAN },
});

console.log({ productId: product.id, priceId: price.id, amount: AMOUNT / 100 });

await db.collection("siteSettings").doc("stripe").set(
  {
    prices: { [PLAN]: price.id },
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  },
  { merge: true }
);
