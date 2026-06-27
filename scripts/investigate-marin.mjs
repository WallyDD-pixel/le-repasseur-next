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

const email = "marin.matic74@gmail.com";
const uid = "1yMqO13GNPVLOJ538GMvpv93qYl1";

const user = (await db.collection("users").doc(uid).get()).data();
console.log("=== User Firestore ===");
console.log(JSON.stringify(user, null, 2));

console.log("\n=== All transactions ===");
const txs = await db.collection("transactions").where("userId", "==", uid).get();
for (const d of txs.docs) {
  console.log(d.id, JSON.stringify(d.data(), null, 2));
}

console.log("\n=== Reservations ===");
for (const field of ["userid", "userId"]) {
  const snap = await db
    .collection("demande de reservation")
    .where(field, "==", uid)
    .get();
  for (const r of snap.docs) {
    const x = r.data();
    console.log({
      id: r.id,
      etat: x.etat,
      kg: x.kg,
      date: x.dateHeureReservation,
      activite: x.activite,
    });
  }
}

const subId = user?.stripeSubscriptionId || "sub_1TWX1iGCDVPnzYlbAPwEEfhd";
const sub = await stripe.subscriptions.retrieve(subId, {
  expand: ["customer", "items.data.price.product"],
});
console.log("\n=== Stripe subscription ===");
console.log({
  id: sub.id,
  status: sub.status,
  created: new Date(sub.created * 1000).toISOString(),
  metadata: sub.metadata,
  customer: typeof sub.customer === "object" ? sub.customer.email : sub.customer,
});

const invoices = await stripe.invoices.list({ subscription: subId, limit: 10 });
console.log("\n=== Stripe invoices ===");
for (const inv of invoices.data.sort((a, b) => a.created - b.created)) {
  console.log({
    id: inv.id,
    date: new Date(inv.created * 1000).toISOString(),
    reason: inv.billing_reason,
    amount: inv.amount_paid / 100,
    paid: inv.status,
  });
}

const sessions = await stripe.checkout.sessions.list({ limit: 100 });
const marinSessions = sessions.data.filter(
  (s) => s.customer_email?.toLowerCase() === email || s.metadata?.firebaseUid === uid
);
console.log("\n=== Checkout sessions (recent, filtered) ===", marinSessions.length);
for (const s of marinSessions) {
  console.log({
    id: s.id,
    mode: s.mode,
    status: s.status,
    created: new Date(s.created * 1000).toISOString(),
    planId: s.metadata?.planId,
    payment_status: s.payment_status,
  });
}

// Expected Solo credits
console.log("\n=== Attendu Solo ===");
console.log("Par mois: +2 collectes, +5 kg (PLAN_DEFAULT_CREDITS)");
