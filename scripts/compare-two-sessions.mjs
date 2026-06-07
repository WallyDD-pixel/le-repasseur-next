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
const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(saJson)) });
const db = admin.firestore();
const settings = (await db.collection("siteSettings").doc("stripe").get()).data();
const stripe = new Stripe(settings.secretKey.trim());

const sessions = [
  "cs_live_a1QFIkGBhsVjbFocvRiJawFHfbWR1kdQilUfLt6zYGcPhFtqf06GjdfAEv",
  "cs_live_a108HjaM7zZM0ZUAH5UVopUVSMaGsiqsF4E3BlXsYhfYqzNwXP7WcSzdD9",
];

for (const id of sessions) {
  const s = await stripe.checkout.sessions.retrieve(id, {
    expand: ["subscription", "invoice", "customer"],
  });
  const tx = await db.collection("transactions").doc(id).get();
  console.log("\n===", id, "===");
  console.log({
    created: new Date(s.created * 1000).toISOString(),
    payment_status: s.payment_status,
    status: s.status,
    customer:
      typeof s.customer === "object"
        ? { id: s.customer.id, email: s.customer.email }
        : s.customer,
    subscription:
      typeof s.subscription === "object"
        ? {
            id: s.subscription.id,
            status: s.subscription.status,
          }
        : s.subscription,
    invoice:
      typeof s.invoice === "object"
        ? { id: s.invoice.id, amount_paid: s.invoice.amount_paid }
        : s.invoice,
    firestoreTx: tx.exists
      ? {
          creditsApplied: tx.data().creditsApplied,
          type: tx.data().type,
          source: tx.data().source,
        }
      : "ABSENT",
  });
}

for (const cus of ["cus_UdBKloqiemH5Se", "cus_UdBMX7zHd9t1CL"]) {
  console.log("\n--- Customer", cus, "---");
  const subs = await stripe.subscriptions.list({ customer: cus, status: "all" });
  for (const sub of subs.data) {
    console.log("sub", sub.id, sub.status, sub.metadata?.planId);
  }
  const invs = await stripe.invoices.list({ customer: cus, limit: 10 });
  for (const inv of invs.data) {
    console.log("inv", inv.id, inv.amount_paid, inv.billing_reason, inv.status);
  }
  const chs = await stripe.charges.list({ customer: cus, limit: 10 });
  for (const ch of chs.data) {
    console.log("charge", ch.id, ch.amount, ch.paid, ch.refunded, ch.amount_refunded);
  }
}

console.log("\n=== Résumé ===");
console.log(
  "2 paiements de 19 € à 3 min d'écart → 2 clients Stripe + 2 abonnements Mino actifs."
);
console.log(
  "Seul le 2e checkout est enregistré dans Firestore (transactions)."
);
