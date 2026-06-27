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

const prices = await stripe.prices.list({ limit: 100, expand: ["data.product"] });
for (const p of prices.data.sort((a, b) => (a.unit_amount ?? 0) - (b.unit_amount ?? 0))) {
  const prod = p.product;
  const name =
    typeof prod === "object" && prod && "name" in prod ? prod.name : "?";
  console.log(
    `${p.id} | active=${p.active} | ${((p.unit_amount ?? 0) / 100).toFixed(2)} € | ${p.recurring?.interval ?? "once"} | ${name}`
  );
}

console.log("\n=== abonnements Firestore ===");
const abo = await db.collection("abonnements").get();
for (const d of abo.docs) {
  const x = d.data();
  console.log(d.id, x.nom ?? x.name, x.stripePriceId ?? x.stripePrice ?? "—");
}
