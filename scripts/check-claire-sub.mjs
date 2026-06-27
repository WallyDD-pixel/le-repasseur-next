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

const sub = await stripe.subscriptions.retrieve("sub_1Tn1xnGCDVPnzYlbesidnOpC");
const c = await stripe.customers.retrieve("cus_Umb99nooI0CBeA");
console.log({
  subStatus: sub.status,
  trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
  customerEmail: c.email,
  defaultPaymentMethod: c.invoice_settings?.default_payment_method ?? c.default_source ?? "AUCUN",
});
