import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import Stripe from "stripe";

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
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const sessionId =
  process.argv[2] ||
  "cs_live_a108HjaM7zZM0ZUAH5UVopUVSMaGsiqsF4E3BlXsYhfYqzNwXP7WcSzdD9";
const uid = process.argv[3] || "4homZaNPw0ULPePhMjru7tEC5PH3";

const session = await stripe.checkout.sessions.retrieve(sessionId, {
  expand: ["subscription", "invoice", "payment_intent", "customer"],
});

console.log("SESSION", {
  id: session.id,
  email: session.customer_details?.email,
  customer_email: session.customer_email,
  customer:
    typeof session.customer === "object"
      ? { id: session.customer.id, email: session.customer.email }
      : session.customer,
  payment_status: session.payment_status,
  amount_total: session.amount_total,
  subscription:
    typeof session.subscription === "object"
      ? session.subscription?.id
      : session.subscription,
  invoice:
    typeof session.invoice === "object" ? session.invoice?.id : session.invoice,
  metadata: session.metadata,
  client_reference_id: session.client_reference_id,
  created: new Date(session.created * 1000).toISOString(),
});

const invId =
  typeof session.invoice === "object" ? session.invoice?.id : session.invoice;
if (invId) {
  const inv = await stripe.invoices.retrieve(invId);
  console.log("INVOICE", {
    id: inv.id,
    number: inv.number,
    amount_paid: inv.amount_paid,
    billing_reason: inv.billing_reason,
    customer: inv.customer,
    customer_email: inv.customer_email,
    status: inv.status,
    payment_intent: inv.payment_intent,
    charge: inv.charge,
  });
}

const customerId =
  typeof session.customer === "object"
    ? session.customer?.id
    : typeof session.customer === "string"
      ? session.customer
      : null;

if (customerId) {
  const subs = await stripe.subscriptions.list({
    customer: customerId,
    limit: 10,
    status: "all",
  });
  console.log("SUBSCRIPTIONS", subs.data.length);
  for (const sub of subs.data) {
    console.log({
      id: sub.id,
      status: sub.status,
      created: new Date(sub.created * 1000).toISOString(),
      planId: sub.metadata?.planId,
    });
  }

  const invoices = await stripe.invoices.list({ customer: customerId, limit: 20 });
  console.log("ALL_INVOICES", invoices.data.length);
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

  const charges = await stripe.charges.list({ customer: customerId, limit: 20 });
  console.log("ALL_CHARGES", charges.data.length);
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
}

const sessions = await stripe.checkout.sessions.list({ limit: 100 });
const byRef = sessions.data.filter(
  (s) =>
    s.client_reference_id === uid || s.metadata?.firebaseUid === uid
);
console.log("SESSIONS_BY_UID", byRef.length);
for (const s of byRef) {
  console.log({
    id: s.id,
    email: s.customer_details?.email,
    amount: s.amount_total,
    created: new Date(s.created * 1000).toISOString(),
    payment_status: s.payment_status,
  });
}

try {
  const pis = await stripe.paymentIntents.search({
    query: `metadata['firebaseUid']:'${uid}'`,
    limit: 20,
  });
  console.log("PIS_BY_UID", pis.data.length);
  for (const pi of pis.data) {
    console.log({
      id: pi.id,
      amount: pi.amount,
      status: pi.status,
      created: new Date(pi.created * 1000).toISOString(),
    });
  }
} catch (e) {
  console.log("PI_SEARCH_ERROR", e instanceof Error ? e.message : e);
}
