/**
 * Diagnostic paiements Stripe + Firestore pour un email client.
 * Usage: node scripts/investigate-user-payments.mjs ucolonna@yahoo.com
 */
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

const email = (process.argv[2] || "").trim().toLowerCase();
if (!email) {
  console.error("Usage: node scripts/investigate-user-payments.mjs <email>");
  process.exit(1);
}

const sk = process.env.STRIPE_SECRET_KEY?.trim();
if (!sk) {
  console.error("STRIPE_SECRET_KEY manquant dans .env.local");
  process.exit(1);
}

const stripe = new Stripe(sk);

function fmtDate(unix) {
  if (!unix) return null;
  return new Date(unix * 1000).toISOString();
}

function fmtEur(cents) {
  if (typeof cents !== "number") return null;
  return `${(cents / 100).toFixed(2)} €`;
}

console.log("=== Investigation:", email, "===\n");

// Stripe customers
const customers = await stripe.customers.list({ email, limit: 10 });
console.log(`Clients Stripe (${customers.data.length}):`);
for (const c of customers.data) {
  console.log(`  - ${c.id} created=${fmtDate(c.created)}`);
}

// Checkout sessions (search by customer email metadata - list recent and filter)
const sessions = await stripe.checkout.sessions.list({ limit: 100 });
const emailSessions = sessions.data.filter((s) => {
  const e =
    s.customer_details?.email?.toLowerCase() ||
    (typeof s.customer_email === "string" ? s.customer_email.toLowerCase() : "");
  return e === email;
});
console.log(`\nSessions Checkout récentes pour cet email (${emailSessions.length} sur 100 dernières):`);
for (const s of emailSessions) {
  console.log({
    id: s.id,
    status: s.status,
    payment_status: s.payment_status,
    mode: s.mode,
    amount: fmtEur(s.amount_total),
    created: fmtDate(s.created),
    planId: s.metadata?.planId,
    subscription: typeof s.subscription === "string" ? s.subscription : s.subscription?.id,
    invoice: typeof s.invoice === "string" ? s.invoice : null,
  });
}

// Subscriptions per customer
for (const c of customers.data) {
  const subs = await stripe.subscriptions.list({ customer: c.id, limit: 20, status: "all" });
  console.log(`\nAbonnements client ${c.id} (${subs.data.length}):`);
  for (const sub of subs.data) {
    console.log({
      id: sub.id,
      status: sub.status,
      created: fmtDate(sub.created),
      planId: sub.metadata?.planId,
      amount: fmtEur(sub.items?.data?.[0]?.price?.unit_amount),
    });
  }

  const invoices = await stripe.invoices.list({ customer: c.id, limit: 20 });
  console.log(`\nFactures client ${c.id} (${invoices.data.length}):`);
  for (const inv of invoices.data) {
    console.log({
      id: inv.id,
      number: inv.number,
      status: inv.status,
      billing_reason: inv.billing_reason,
      amount_paid: fmtEur(inv.amount_paid),
      created: fmtDate(inv.created),
      subscription:
        typeof inv.subscription === "string" ? inv.subscription : inv.subscription?.id,
    });
  }

  const charges = await stripe.charges.list({ customer: c.id, limit: 20 });
  console.log(`\nCharges client ${c.id} (${charges.data.length}):`);
  for (const ch of charges.data) {
    console.log({
      id: ch.id,
      amount: fmtEur(ch.amount),
      paid: ch.paid,
      refunded: ch.refunded,
      created: fmtDate(ch.created),
      description: ch.description,
      invoice: typeof ch.invoice === "string" ? ch.invoice : null,
      payment_intent: typeof ch.payment_intent === "string" ? ch.payment_intent : null,
    });
  }
}

// Firestore
const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
if (saJson) {
  try {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(saJson)),
      });
    }
    const db = admin.firestore();

    const users = await db.collection("users").where("email", "==", email).limit(5).get();
    console.log(`\nUtilisateurs Firestore (${users.size}):`);
    for (const doc of users.docs) {
      const d = doc.data();
      console.log({
        uid: doc.id,
        role: d.role,
        reservations: d.reservations,
        collectes: d.collectes,
        createdAt: d.createdAt?.toDate?.()?.toISOString?.() ?? null,
      });

      const txs = await db.collection("transactions").where("userId", "==", doc.id).get();
      console.log(`  Transactions (${txs.size}):`);
      const rows = txs.docs.map((t) => {
        const x = t.data();
        return {
          id: t.id,
          type: x.type,
          titre: x.titre,
          montant: x.montant,
          source: x.source,
          creditsApplied: x.creditsApplied,
          stripeCheckoutSessionId: x.stripeCheckoutSessionId,
          stripeInvoiceId: x.stripeInvoiceId,
          createdAt: x.createdAt?.toDate?.()?.toISOString?.() ?? null,
        };
      });
      rows.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
      for (const r of rows) console.log("   ", r);
    }
  } catch (e) {
    console.error("\nFirestore:", e instanceof Error ? e.message : e);
  }
} else {
  console.log("\n(FIREBASE_SERVICE_ACCOUNT_JSON absent — pas de lecture Firestore)");
}
