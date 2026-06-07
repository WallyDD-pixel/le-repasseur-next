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
const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(saJson)) });
const db = admin.firestore();

const snap = await db.collection("siteSettings").doc("stripe").get();
if (!snap.exists) {
  console.log("No siteSettings/stripe");
  process.exit(0);
}
const d = snap.data();
const sk = typeof d.secretKey === "string" ? d.secretKey : "";
console.log({
  hasPublishableKey: Boolean(d.publishableKey),
  secretKeyPrefix: sk ? sk.slice(0, 16) + "…" : null,
  secretKeyMode: sk.startsWith("sk_live") ? "live" : sk.startsWith("sk_test") ? "test" : "?",
  pricesCount: d.prices ? Object.keys(d.prices).length : 0,
});
