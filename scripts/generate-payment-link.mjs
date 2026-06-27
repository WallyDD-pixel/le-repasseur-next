/**
 * Génère un lien frais pour enregistrer la carte bancaire (Claire / Umbrella).
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
admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
  ),
});
const db = admin.firestore();
const settings = (await db.collection("siteSettings").doc("stripe").get()).data();
const stripe = new Stripe(settings.secretKey.trim());

const EMAIL = process.argv[2] || "claire.desclercs@gmail.com";
const users = await db.collection("users").where("email", "==", EMAIL).get();
if (users.empty) {
  console.error("User not found");
  process.exit(1);
}
const user = users.docs[0].data();
const customerId = user.stripeCustomerId;
const subId = user.stripeSubscriptionId;

if (!customerId?.startsWith("cus_")) {
  console.error("Pas de stripeCustomerId Umbrella");
  process.exit(1);
}

console.log("Customer:", customerId, "| Sub:", subId);

// Option 1 : portail client Stripe (recommandé — gère abo + carte)
try {
  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: "https://www.le-repasseur.fr/espace-client",
  });
  console.log("\n=== Portail client Stripe (recommandé) ===");
  console.log(portal.url);
} catch (e) {
  console.warn("Portail indisponible:", e.message);
}

// Option 2 : checkout setup (nouvelle session)
const setup = await stripe.checkout.sessions.create({
  mode: "setup",
  customer: customerId,
  payment_method_types: ["card"],
  success_url: "https://www.le-repasseur.fr/espace-client?carte=ok",
  cancel_url: "https://www.le-repasseur.fr/espace-client?carte=annule",
  locale: "fr",
});
console.log("\n=== Checkout enregistrement carte ===");
console.log("Session:", setup.id);
console.log("URL:", setup.url);

// Vérifier que la session est accessible
const check = await stripe.checkout.sessions.retrieve(setup.id);
console.log("\nStatut session:", check.status, "| expires:", new Date(check.expires_at * 1000).toLocaleString("fr-FR"));
