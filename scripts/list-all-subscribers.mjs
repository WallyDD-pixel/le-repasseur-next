/**
 * Compare abonnés Firestore (rôle formule) vs abonnements Stripe actifs.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import Stripe from "stripe";
import admin from "firebase-admin";

const SUB_ROLES = new Set([
  "Mino",
  "Solo",
  "Duo",
  "Marmo",
  "Super Héros",
  "Super hero",
  "Essai 1€",
  "Première panière test",
]);

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

const usersSnap = await db.collection("users").get();
const firestoreSubs = [];
const otherWithQuotas = [];

for (const doc of usersSnap.docs) {
  const d = doc.data();
  const email = String(d.email ?? "").toLowerCase();
  const role = String(d.role ?? "").trim();
  const res = d.reservations;
  const kg = d.collectes ?? d.kg;
  const row = {
    uid: doc.id,
    email,
    role,
    reservations: res,
    collectes: kg,
    stripeCustomerId: d.stripeCustomerId,
    stripeSubscriptionId: d.stripeSubscriptionId,
  };
  if (SUB_ROLES.has(role)) firestoreSubs.push(row);
  else if (
    (typeof res === "number" && res > 0) ||
    (typeof kg === "number" && kg > 0)
  ) {
    otherWithQuotas.push(row);
  }
}

const stripeActiveByEmail = new Map();
let startingAfter;
for (;;) {
  const page = await stripe.subscriptions.list({
    status: "active",
    limit: 100,
    ...(startingAfter ? { starting_after: startingAfter } : {}),
  });
  for (const sub of page.data) {
    const customerId =
      typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
    let email = "";
    if (customerId) {
      const c = await stripe.customers.retrieve(customerId);
      if (!c.deleted && c.email) email = c.email.trim().toLowerCase();
    }
    if (!email) continue;
    stripeActiveByEmail.set(email, {
      subId: sub.id,
      customerId,
      planMeta: sub.metadata?.planId,
    });
  }
  if (!page.has_more || page.data.length === 0) break;
  startingAfter = page.data[page.data.length - 1].id;
}

console.log("=== Abonnés Firestore (rôle formule) ===\n");
for (const u of firestoreSubs.sort((a, b) => a.email.localeCompare(b.email))) {
  const stripe = stripeActiveByEmail.get(u.email);
  const flag = stripe ? "STRIPE ACTIF" : "PAS D'ABO STRIPE ACTIF";
  console.log(`[${flag}] ${u.email}`);
  console.log(`  rôle=${u.role} | collectes=${u.reservations} | kg=${u.collectes}`);
  console.log(`  stripeSub doc=${u.stripeSubscriptionId ?? "—"} | stripe live=${stripe?.subId ?? "—"}`);
  console.log("");
}

console.log("=== Autres comptes avec quotas > 0 mais rôle ≠ formule ===\n");
for (const u of otherWithQuotas.sort((a, b) => a.email.localeCompare(b.email))) {
  const stripe = stripeActiveByEmail.get(u.email);
  console.log(
    `[${stripe ? "STRIPE ACTIF" : "legacy/hors stripe"}] ${u.email} — rôle=${u.role} | ${u.reservations} collectes | ${u.collectes} kg`
  );
}

console.log("\n=== Stripe actifs sans compte Firestore formule ===\n");
const fsEmails = new Set(firestoreSubs.map((u) => u.email));
for (const [email, s] of stripeActiveByEmail) {
  if (!fsEmails.has(email)) {
    console.log(`• ${email} — ${s.subId}`);
  }
}

console.log(`\nRésumé: ${firestoreSubs.length} abonnés Firestore, ${stripeActiveByEmail.size} Stripe actifs`);
