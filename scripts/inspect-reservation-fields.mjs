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
const snap = await db.collection(COL).limit(5).get();
console.log("Sample reservations:");
for (const d of snap.docs) {
  console.log("\n---", d.id);
  console.log(JSON.stringify(d.data(), null, 2));
}

const restitu = await db
  .collection(COL)
  .where("etat", ">=", "Linge")
  .limit(3)
  .get();
console.log("\n\nWith etat Linge*:", restitu.size);
for (const d of restitu.docs) {
  const data = d.data();
  const uid = data.userId || data.uid;
  console.log({ id: d.id, etat: data.etat, uid });
  if (uid) {
    const u = await db.collection("users").doc(uid).get();
    const ud = u.data() || {};
    const keys = Object.keys(ud).filter((k) =>
      /reserv|demande|linge|en cours|cours|commande/i.test(k)
    );
    console.log(
      "user flags:",
      keys.reduce((o, k) => ({ ...o, [k]: ud[k] }), {})
    );
  }
}
