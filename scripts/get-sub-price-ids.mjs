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

for (const subId of [
  "sub_1RiGtNGCDVPnzYlbdsbrU67i", // Horace Solo
  "sub_1TWX1iGCDVPnzYlbAPwEEfhd", // Marin Solo
  "sub_1Q4RKaGCDVPnzYlb57fJMlX9", // Coralie Mino
]) {
  const sub = await stripe.subscriptions.retrieve(subId, {
    expand: ["items.data.price.product"],
  });
  const item = sub.items.data[0];
  const price = item?.price;
  const prod = price?.product;
  const name = typeof prod === "object" && prod && "name" in prod ? prod.name : "?";
  console.log(subId, name, price?.id, price?.unit_amount, price?.active);
}
