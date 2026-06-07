import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
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

const users = await db.collection("users").get();
const txs = await db.collection("transactions").get();

const byUser = new Map();
for (const doc of txs.docs) {
  const d = doc.data();
  const uid = d.userId;
  if (!uid) continue;
  if (!byUser.has(uid)) byUser.set(uid, []);
  byUser.get(uid).push({
    id: doc.id,
    type: d.type,
    role: d.role,
    montant: d.montant,
    creditsApplied: d.creditsApplied,
    stripe: Boolean(d.stripeInvoiceId || d.stripeCheckoutSessionId),
    newStyleId: doc.id.startsWith("cs_") || doc.id.startsWith("inv_"),
  });
}

console.log("=== Comptes actuels (28) ===\n");
for (const u of users.docs) {
  const d = u.data();
  const list = byUser.get(u.id) ?? [];
  const missing = list.filter(
    (t) =>
      !t.creditsApplied &&
      (t.stripe || t.newStyleId || /abonnement|renouvellement|paiement/i.test(String(t.type)))
  );
  const applied = list.filter((t) => t.creditsApplied);
  console.log({
    email: d.email,
    role: d.role,
    reservations: d.reservations,
    collectes: d.collectes,
    txTotal: list.length,
    creditsApplied: applied.length,
    missingCredits: missing.length,
    stripeTx: list.filter((t) => t.stripe || t.newStyleId).length,
  });
}
