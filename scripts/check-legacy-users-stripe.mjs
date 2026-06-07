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

const emails = [
  "cedric.lodovicci@outlook.fr",
  "claire.desclercs@gmail.com",
  "thom.malika@gmail.com",
  "horace@azur-clim-service.com",
  "marin.matic74@gmail.com",
  "coralierollin@live.fr",
  "info@universal-hygiene.com",
];

for (const email of emails) {
  const users = await db.collection("users").where("email", "==", email).limit(1).get();
  const u = users.empty ? null : users.docs[0];
  const d = u?.data() ?? {};
  const customers = await stripe.customers.list({ email, limit: 5 });
  let activeSubs = [];
  let allSubs = [];
  for (const c of customers.data) {
    const subs = await stripe.subscriptions.list({ customer: c.id, status: "all", limit: 10 });
    allSubs.push(
      ...subs.data.map((s) => ({
        sub: s.id,
        status: s.status,
        plan: s.metadata?.planId,
        customer: c.id,
      }))
    );
    activeSubs = allSubs.filter((s) => s.status === "active");
  }
  console.log({
    email,
    firestoreRole: d.role,
    reservations: d.reservations,
    collectes: d.collectes,
    stripeCustomerId: d.stripeCustomerId,
    stripeSubscriptionId: d.stripeSubscriptionId,
    stripeCustomers: customers.data.length,
    activeStripeSubs: activeSubs,
    allStripeSubs: allSubs,
  });
}
