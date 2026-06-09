/**
 * Corrige les demandes « Linge restitué » sans activite=inactif
 * (bloquent encore l’app mobile).
 */
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
const COL = "demande de reservation";

const snap = await db.collection(COL).get();
let fixed = 0;
for (const d of snap.docs) {
  const data = d.data();
  const etat = String(data.etat || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (!etat.includes("restitu")) continue;
  if (String(data.activite || "").toLowerCase() === "inactif") continue;
  await d.ref.update({ activite: "inactif" });
  console.log("fixed", d.id, data.prenom, data.nom, "→ activite=inactif");
  fixed++;
}
console.log(`\n${fixed} document(s) corrigé(s).`);
