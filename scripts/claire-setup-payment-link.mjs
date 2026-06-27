/** Lien Stripe pour que Claire ajoute sa carte sur Umbrella. */
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

const customerId = "cus_Umb99nooI0CBeA";
const session = await stripe.checkout.sessions.create({
  mode: "setup",
  customer: customerId,
  payment_method_types: ["card"],
  success_url: "https://www.le-repasseur.fr/espace-client?carte=ok",
  cancel_url: "https://www.le-repasseur.fr/espace-client",
});
console.log("Lien à envoyer à Claire pour enregistrer sa carte :\n", session.url);
