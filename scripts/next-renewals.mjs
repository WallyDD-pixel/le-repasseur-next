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

let after;
const subs = [];
for (;;) {
  const page = await stripe.subscriptions.list({
    status: "active",
    limit: 100,
    ...(after ? { starting_after: after } : {}),
  });
  subs.push(...page.data);
  if (!page.has_more || !page.data.length) break;
  after = page.data.at(-1).id;
}

console.log("Email | Prochain prélèvement | Montant/mois | Abonnement Stripe\n");
for (const sub of subs.sort(
  (a, b) => (a.current_period_end ?? 0) - (b.current_period_end ?? 0)
)) {
  const cid = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  const c = await stripe.customers.retrieve(cid);
  const email = !c.deleted ? c.email : "?";
  const end = sub.current_period_end
    ? new Date(sub.current_period_end * 1000).toLocaleDateString("fr-FR")
    : "?";
  const amt = sub.items.data[0]?.price?.unit_amount;
  console.log(`${email} | ${end} | ${amt ? amt / 100 + " €" : "?"} | ${sub.id}`);
}
