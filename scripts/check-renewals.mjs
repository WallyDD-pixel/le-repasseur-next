/**
 * Liste les renouvellements d'abonnements (Stripe + Firestore).
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

function fmt(d) {
  if (!d) return "—";
  return d.toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
}

function euros(cents) {
  if (cents == null) return "—";
  return `${(cents / 100).toFixed(2).replace(".", ",")} €`;
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

const daysBack = Number(process.argv[2] || 60);
const since = Math.floor(Date.now() / 1000) - daysBack * 86400;

console.log(`\n=== Renouvellements Stripe (factures subscription_cycle, ${daysBack} derniers jours) ===\n`);

const stripeRenewals = [];
let startingAfter;
for (;;) {
  const page = await stripe.invoices.list({
    limit: 100,
    status: "paid",
    ...(startingAfter ? { starting_after: startingAfter } : {}),
  });
  for (const inv of page.data) {
    if (inv.created < since) continue;
    if (inv.billing_reason !== "subscription_cycle") continue;
    stripeRenewals.push(inv);
  }
  const oldest = page.data[page.data.length - 1];
  if (!page.has_more || !oldest || oldest.created < since) break;
  startingAfter = oldest.id;
}

stripeRenewals.sort((a, b) => b.created - a.created);

const usersById = new Map();
const usersSnap = await db.collection("users").get();
for (const d of usersSnap.docs) {
  usersById.set(d.id, d.data());
}

for (const inv of stripeRenewals) {
  const email =
    inv.customer_email ||
    (typeof inv.customer === "string"
      ? (await stripe.customers.retrieve(inv.customer)).email
      : inv.customer?.email) ||
    "—";
  const subId =
    typeof inv.subscription === "string"
      ? inv.subscription
      : inv.subscription?.id || "—";
  console.log(`${fmt(new Date(inv.created * 1000))} | ${email}`);
  console.log(`  facture ${inv.id} | ${euros(inv.amount_paid)} | abo ${subId}`);
  console.log(`  crédits appliqués Firestore: ${inv.metadata?.creditsApplied ?? "—"}`);
}

console.log(`\nTotal Stripe: ${stripeRenewals.length} renouvellement(s)\n`);

console.log(`=== Transactions Firestore type "renouvellement" (${daysBack} jours) ===\n`);

const txSnap = await db.collection("transactions").get();
const firestoreRenewals = [];

for (const doc of txSnap.docs) {
  const tx = doc.data();
  const type = String(tx.type ?? "").toLowerCase();
  if (!type.includes("renouvel")) continue;

  let date = null;
  for (const k of ["transactionDate", "createdAt", "date", "timestamp"]) {
    const v = tx[k];
    if (v?.toDate) {
      date = v.toDate();
      break;
    }
  }
  if (date && date.getTime() < Date.now() - daysBack * 86400000) continue;

  const uid = tx.userId;
  const user = uid ? usersById.get(uid) : null;
  firestoreRenewals.push({
    id: doc.id,
    date,
    email: user?.email ?? tx.email ?? "—",
    plan: tx.role ?? tx.titre ?? "—",
    amount: tx.montant ?? tx.amount ?? tx.prix,
    creditsApplied: tx.creditsApplied,
    stripeInvoiceId: tx.stripeInvoiceId,
    uid,
    role: user?.role,
    collectes: user?.collectes ?? user?.kg,
    reservations: user?.reservations,
  });
}

firestoreRenewals.sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));

for (const r of firestoreRenewals) {
  console.log(`${fmt(r.date)} | ${r.email}`);
  console.log(`  tx ${r.id} | ${r.plan} | créditsApplied=${r.creditsApplied ?? "—"}`);
  console.log(
    `  compte: rôle=${r.role ?? "—"} | ${r.reservations ?? "—"} collectes | ${r.collectes ?? "—"} kg`
  );
  if (r.stripeInvoiceId) console.log(`  stripeInvoiceId=${r.stripeInvoiceId}`);
}

console.log(`\nTotal Firestore: ${firestoreRenewals.length} renouvellement(s)\n`);

// Abonnements actifs — prochaine facture
console.log("=== Abonnements Stripe actifs — prochain renouvellement ===\n");

const activeSubs = [];
startingAfter = undefined;
for (;;) {
  const page = await stripe.subscriptions.list({
    status: "active",
    limit: 100,
    ...(startingAfter ? { starting_after: startingAfter } : {}),
  });
  activeSubs.push(...page.data);
  if (!page.has_more || !page.data.length) break;
  startingAfter = page.data[page.data.length - 1].id;
}

activeSubs.sort((a, b) => (a.current_period_end ?? 0) - (b.current_period_end ?? 0));

for (const sub of activeSubs) {
  const cid = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  let email = "—";
  if (cid) {
    const c = await stripe.customers.retrieve(cid);
    if (!c.deleted) email = c.email ?? "—";
  }
  const plan = sub.metadata?.planId ?? sub.items?.data?.[0]?.price?.nickname ?? "—";
  const end = sub.current_period_end
    ? new Date(sub.current_period_end * 1000)
    : null;
  console.log(`${email}`);
  console.log(`  plan=${plan} | prochaine échéance: ${fmt(end)} | sub=${sub.id}`);
}

console.log(`\n${activeSubs.length} abonnement(s) actif(s) sur Stripe`);

// Écarts: Stripe renewal sans tx Firestore
console.log("\n=== Écarts (Stripe payé sans tx Firestore renouvellement) ===\n");
const fsInvoiceIds = new Set(
  firestoreRenewals.map((r) => r.stripeInvoiceId).filter(Boolean)
);
let gaps = 0;
for (const inv of stripeRenewals) {
  if (!fsInvoiceIds.has(inv.id)) {
    gaps++;
    const email = inv.customer_email || "—";
    console.log(`⚠ ${fmt(new Date(inv.created * 1000))} | ${email} | ${inv.id} | ${euros(inv.amount_paid)}`);
  }
}
if (gaps === 0) console.log("Aucun écart détecté sur la période.");
