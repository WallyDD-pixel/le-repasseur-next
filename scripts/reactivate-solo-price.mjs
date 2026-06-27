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

const SOLO_PRICE = "price_1TWX1SGCDVPnzYlbWQn55gl1";
const p = await stripe.prices.retrieve(SOLO_PRICE);
console.log("Before:", p.id, p.active, p.product, p.unit_amount);

const updated = await stripe.prices.update(SOLO_PRICE, { active: true });
console.log("After:", updated.id, updated.active);

await db.collection("siteSettings").doc("stripe").set(
  {
    prices: { Solo: SOLO_PRICE },
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  },
  { merge: true }
);
console.log("Firestore siteSettings/stripe.prices.Solo =", SOLO_PRICE);
