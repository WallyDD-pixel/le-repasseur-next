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
const snap = await db.collection("demande de reservation").limit(300).get();
const byEtat = {};
for (const d of snap.docs) {
  const x = d.data();
  const etat = String(x.etat || "?");
  const act = String(x.activite ?? "(absent)");
  const k = `${etat} | activite=${act}`;
  byEtat[k] = (byEtat[k] || 0) + 1;
}
for (const [k, v] of Object.entries(byEtat).sort((a, b) => b[1] - a[1])) {
  console.log(`${v}x ${k}`);
}
