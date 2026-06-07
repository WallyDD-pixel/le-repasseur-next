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

const PLANS = new Set(["Mino", "Solo", "Duo", "Marmo", "Super Héros", "Super hero"]);

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
const usersById = new Map();
for (const d of usersSnap.docs) {
  usersById.set(d.id, { email: String(d.data().email ?? "").toLowerCase(), ...d.data() });
}

const txSnap = await db.collection("transactions").get();
const byUid = new Map();

for (const doc of txSnap.docs) {
  const tx = doc.data();
  const uid = tx.userId;
  if (!uid) continue;
  const type = String(tx.type ?? "").toLowerCase();
  const role = String(tx.role ?? "").trim();
  const isSub =
    type.includes("abonnement") ||
    type.includes("renouvellement") ||
    PLANS.has(role);
  if (!isSub && !PLANS.has(role)) continue;

  if (!byUid.has(uid)) {
    const u = usersById.get(uid);
    byUid.set(uid, {
      uid,
      email: u?.email ?? "(compte supprimé)",
      exists: Boolean(u),
      firestoreRole: u?.role,
      reservations: u?.reservations,
      collectes: u?.collectes ?? u?.kg,
      plans: new Set(),
      txCount: 0,
      lastType: type,
    });
  }
  const row = byUid.get(uid);
  row.txCount++;
  if (PLANS.has(role)) row.plans.add(role);
  row.lastType = type;
}

const stripeEmails = new Set();
let startingAfter;
for (;;) {
  const page = await stripe.subscriptions.list({
    status: "active",
    limit: 100,
    ...(startingAfter ? { starting_after: startingAfter } : {}),
  });
  for (const sub of page.data) {
    const cid = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
    if (!cid) continue;
    const c = await stripe.customers.retrieve(cid);
    if (!c.deleted && c.email) stripeEmails.add(c.email.toLowerCase());
  }
  if (!page.has_more || !page.data.length) break;
  startingAfter = page.data[page.data.length - 1].id;
}

console.log("=== Clients avec historique abonnement (transactions) ===\n");

const current = [];
const legacyOnly = [];
const deleted = [];

for (const row of [...byUid.values()].sort((a, b) =>
  a.email.localeCompare(b.email)
)) {
  const inStripe = stripeEmails.has(row.email);
  const plan = [...row.plans].join(", ") || row.lastType;
  const enriched = { ...row, plans: plan, inStripe };
  if (!row.exists) deleted.push(enriched);
  else if (inStripe) current.push(enriched);
  else legacyOnly.push(enriched);
}

function printGroup(title, rows) {
  console.log(`--- ${title} (${rows.length}) ---`);
  for (const r of rows) {
    console.log(`• ${r.email}`);
    console.log(
      `  compte: rôle=${r.firestoreRole ?? "—"} | ${r.reservations ?? "—"} collectes | ${r.collectes ?? "—"} kg`
    );
    console.log(`  historique: ${r.txCount} tx | plan(s): ${r.plans} | stripe actif: ${r.inStripe ? "oui" : "non"}`);
  }
  console.log("");
}

printGroup("Compte actif + Stripe actif (sync:stripe les voit)", current);
printGroup("Compte actif LEGACY — abonné ancien site, PAS dans sync:stripe", legacyOnly);
printGroup("Compte SUPPRIMÉ — historique seulement", deleted);

console.log(
  `Total historique abonnement: ${byUid.size} UID | actifs legacy hors Stripe: ${legacyOnly.length}`
);
