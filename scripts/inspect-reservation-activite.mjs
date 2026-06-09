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

const gwen = await db.collection(COL).doc("1Mj6Xb5os8etpOLNb4cm").get();
console.log("Gwen reservation:", gwen.data());

const uid = "2CnKsTBY67Zqi3EPhRdV6JTX1gz1";
const user = await db.collection("users").doc(uid).get();
const userData = user.data() || {};
const interesting = Object.entries(userData).filter(([k]) =>
  /activ|reserv|demande|commande|linge|cours/i.test(k)
);
console.log("\nGwen user reservation-related fields:", Object.fromEntries(interesting));

const all = await db.collection(COL).where("userid", "==", uid).get();
console.log("\nAll Gwen reservations:");
for (const d of all.docs) {
  const x = d.data();
  console.log({
    id: d.id,
    etat: x.etat,
    activite: x.activite,
    kg: x.kg,
    date: x.dateHeureReservation,
  });
}

// Count restitué without activite inactif
const snap = await db.collection(COL).limit(500).get();
let restituNoInactif = 0;
let restituInactif = 0;
let openActif = 0;
for (const d of snap.docs) {
  const x = d.data();
  const etat = String(x.etat || "").toLowerCase();
  const act = String(x.activite || "").toLowerCase();
  if (etat.includes("restitu")) {
    if (act === "inactif") restituInactif++;
    else restituNoInactif++;
  } else if (act === "actif") openActif++;
}
console.log("\nStats (sample 500):", {
  restituInactif,
  restituNoInactif,
  openActif,
});
