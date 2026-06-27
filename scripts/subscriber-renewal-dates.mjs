/**
 * Dates de renouvellement par abonné actif (passés + prochain).
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

function fmt(ts) {
  if (!ts) return "—";
  const d = typeof ts === "number" ? new Date(ts * 1000) : ts;
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
}

function fmtFull(ts) {
  if (!ts) return "—";
  const d = typeof ts === "number" ? new Date(ts * 1000) : ts;
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
}

function periodEnd(sub) {
  const item = sub.items?.data?.[0];
  return (
    item?.current_period_end ??
    sub.current_period_end ??
    null
  );
}

function periodStart(sub) {
  const item = sub.items?.data?.[0];
  return (
    item?.current_period_start ??
    sub.current_period_start ??
    null
  );
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

let after;
const subs = [];
for (;;) {
  const page = await stripe.subscriptions.list({
    status: "active",
    limit: 100,
    expand: ["data.items.data.price"],
    ...(after ? { starting_after: after } : {}),
  });
  subs.push(...page.data);
  if (!page.has_more || !page.data.length) break;
  after = page.data.at(-1).id;
}

subs.sort((a, b) => (periodEnd(a) ?? 0) - (periodEnd(b) ?? 0));

for (const sub of subs) {
  const cid = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  const c = await stripe.customers.retrieve(cid);
  const email = !c.deleted ? c.email ?? "—" : "—";

  const price = sub.items?.data?.[0]?.price;
  const amount = price?.unit_amount;
  const interval = price?.recurring?.interval === "month" ? "mois" : price?.recurring?.interval ?? "—";
  const planMeta = sub.metadata?.planId ?? price?.nickname ?? "—";

  const start = periodStart(sub);
  const end = periodEnd(sub);

  console.log(`\n${"=".repeat(60)}`);
  console.log(`${email}`);
  console.log(`Formule: ${planMeta} | ${euros(amount)} / ${interval}`);
  console.log(`Période en cours: ${fmt(start)} → ${fmt(end)}`);
  console.log(`Prochain renouvellement: ${fmt(end)}`);
  console.log(`Abonnement Stripe: ${sub.id}`);

  const invoices = await stripe.invoices.list({
    subscription: sub.id,
    status: "paid",
    limit: 12,
  });

  const renewals = invoices.data
    .filter((inv) => inv.billing_reason === "subscription_cycle")
    .sort((a, b) => b.created - a.created);

  if (renewals.length === 0) {
    console.log("Historique renouvellements: aucun (premier cycle ou legacy)");
  } else {
    console.log(`Historique renouvellements (${renewals.length}):`);
    for (const inv of renewals) {
      console.log(`  • ${fmtFull(inv.created)} — ${euros(inv.amount_paid)} — ${inv.id}`);
    }
  }

  const first = invoices.data.find((inv) => inv.billing_reason === "subscription_create");
  if (first) {
    console.log(`Souscription initiale: ${fmtFull(first.created)} — ${euros(first.amount_paid)}`);
  }
}

console.log(`\n${"=".repeat(60)}`);
console.log(`Total: ${subs.length} abonné(s) actif(s)`);
