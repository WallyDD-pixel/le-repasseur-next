import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import Stripe from "stripe";
import admin from "firebase-admin";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
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
const sk = (await db.collection("siteSettings").doc("stripe").get()).data()
  .secretKey;
const stripe = new Stripe(sk);

const users = await db
  .collection("users")
  .where("email", "==", "claire.desclercs@gmail.com")
  .get();
const uid = users.docs[0]?.id;
const txs = await db.collection("transactions").where("userId", "==", uid).get();
for (const doc of txs.docs) {
  console.log("TX", doc.id, doc.data());
  if (doc.id.startsWith("cs_")) {
    try {
      const s = await stripe.checkout.sessions.retrieve(doc.id, {
        expand: ["subscription", "customer"],
      });
      console.log("SESSION", {
        status: s.status,
        payment_status: s.payment_status,
        email: s.customer_details?.email,
        customer: typeof s.customer === "object" ? s.customer?.id : s.customer,
        subscription:
          typeof s.subscription === "object"
            ? { id: s.subscription?.id, status: s.subscription?.status }
            : s.subscription,
      });
    } catch (e) {
      console.log("SESSION ERR", e.message);
    }
  }
}
