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
const email = "claire.desclercs@gmail.com";

const users = await db.collection("users").where("email", "==", email).get();
for (const u of users.docs) {
  console.log("=== User doc ===");
  console.log(JSON.stringify({ id: u.id, ...u.data() }, null, 2));
}

const txs = await db.collection("transactions").where("userId", "==", users.docs[0]?.id).get();
console.log("\n=== Transactions ===");
for (const t of txs.docs) {
  console.log(JSON.stringify(t.data(), null, 2));
}

const settings = (await db.collection("siteSettings").doc("stripe").get()).data();
console.log("\n=== Umbrella Stripe account (siteSettings) ===");
console.log({
  publishableKeyPrefix: settings.publishableKey?.slice(0, 20),
  secretKeyPrefix: settings.secretKey?.slice(0, 20),
});
