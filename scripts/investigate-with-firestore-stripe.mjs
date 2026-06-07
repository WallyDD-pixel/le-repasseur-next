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
const sk = settings?.secretKey?.trim();
if (!sk) {
  console.error("Pas de secretKey dans siteSettings/stripe");
  process.exit(1);
}

console.log("Using Firestore Stripe key:", sk.slice(0, 16) + "…");
const stripe = new Stripe(sk);

const email = "ucolonna@yahoo.com";
const uid = "4homZaNPw0ULPePhMjru7tEC5PH3";
const sessionId =
  "cs_live_a108HjaM7zZM0ZUAH5UVopUVSMaGsiqsF4E3BlXsYhfYqzNwXP7WcSzdD9";

const customers = await stripe.customers.list({ email, limit: 10 });
console.log("Customers:", customers.data.length);
for (const c of customers.data) {
  console.log(" customer", c.id, new Date(c.created * 1000).toISOString());
}

try {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription", "invoice", "customer"],
  });
  console.log("Session OK", {
    id: session.id,
    email: session.customer_details?.email,
    amount: session.amount_total,
    payment_status: session.payment_status,
    subscription:
      typeof session.subscription === "object"
        ? session.subscription?.id
        : session.subscription,
    invoice:
      typeof session.invoice === "object" ? session.invoice?.id : session.invoice,
    created: new Date(session.created * 1000).toISOString(),
  });
} catch (e) {
  console.log("Session ERR", e instanceof Error ? e.message : e);
}

const customerId = customers.data[0]?.id;
if (customerId) {
  const invoices = await stripe.invoices.list({ customer: customerId, limit: 30 });
  console.log("Invoices:", invoices.data.length);
  for (const inv of invoices.data) {
    console.log({
      id: inv.id,
      number: inv.number,
      amount_paid: inv.amount_paid,
      billing_reason: inv.billing_reason,
      status: inv.status,
      created: new Date(inv.created * 1000).toISOString(),
    });
  }

  const charges = await stripe.charges.list({ customer: customerId, limit: 30 });
  console.log("Charges:", charges.data.length);
  for (const ch of charges.data) {
    console.log({
      id: ch.id,
      amount: ch.amount,
      paid: ch.paid,
      refunded: ch.refunded,
      created: new Date(ch.created * 1000).toISOString(),
      invoice: ch.invoice,
    });
  }

  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 20,
  });
  console.log("Subscriptions:", subs.data.length);
  for (const sub of subs.data) {
    console.log({
      id: sub.id,
      status: sub.status,
      created: new Date(sub.created * 1000).toISOString(),
      planId: sub.metadata?.planId,
    });
  }
}

const sessions = await stripe.checkout.sessions.list({ limit: 100 });
const byUid = sessions.data.filter(
  (s) =>
    s.client_reference_id === uid || s.metadata?.firebaseUid === uid
);
const byEmail = sessions.data.filter((s) => {
  const e =
    s.customer_details?.email?.toLowerCase() ||
    (typeof s.customer_email === "string" ? s.customer_email.toLowerCase() : "");
  return e === email;
});
console.log("Checkout sessions by UID (last 100):", byUid.length);
for (const s of byUid) {
  console.log({
    id: s.id,
    amount: s.amount_total,
    payment_status: s.payment_status,
    created: new Date(s.created * 1000).toISOString(),
  });
}
console.log("Checkout sessions by email (last 100):", byEmail.length);
for (const s of byEmail) {
  console.log({
    id: s.id,
    amount: s.amount_total,
    payment_status: s.payment_status,
    created: new Date(s.created * 1000).toISOString(),
  });
}
