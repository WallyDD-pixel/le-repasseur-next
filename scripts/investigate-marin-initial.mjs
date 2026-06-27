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

const sessionId = "cs_live_a1ut46vxlyZvCvyhTeBTpP0VbntXqYP9b9RTlILadsLXMxNWh4dko7zhQR";
const session = await stripe.checkout.sessions.retrieve(sessionId, {
  expand: ["line_items", "subscription", "invoice"],
});
console.log("=== Checkout initial Marin (13/05) ===");
console.log(JSON.stringify({
  id: session.id,
  status: session.status,
  payment_status: session.payment_status,
  client_reference_id: session.client_reference_id,
  metadata: session.metadata,
  subscription: typeof session.subscription === "object" ? session.subscription?.id : session.subscription,
  invoice: typeof session.invoice === "object" ? session.invoice?.id : session.invoice,
  amount_total: session.amount_total,
}, null, 2));

const tx = await db.collection("transactions").doc(sessionId).get();
console.log("\nTransaction Firestore cs_*:", tx.exists ? tx.data() : "ABSENTE");

const invId = "in_1TWX1iGCDVPnzYlbp77gnSTo";
const invTx = await db.collection("transactions").doc(`inv_${invId}`).get();
console.log("Transaction Firestore inv_* subscription_create:", invTx.exists ? invTx.data() : "ABSENTE");

// Simulate what renewal added
console.log("\n=== Reconstruction quotas ===");
console.log("Solo/mois: +2 collectes, +5 kg");
console.log("Renouvellement 13/06: creditsApplied=true → OK");
console.log("Souscription 13/05: pas de transaction cs_ ni inv_ → crédits 1er mois probablement JAMAIS appliqués via le site");
