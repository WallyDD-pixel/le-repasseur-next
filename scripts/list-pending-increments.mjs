/**
 * Liste les utilisateurs ACTUELS qui ont encore une transaction Stripe (nouveau site)
 * sans creditsApplied — donc incrémentation à faire.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import admin from "firebase-admin";

const PLAN = {
  Mino: { reservations: 1, kg: 2.5 },
  Solo: { reservations: 2, kg: 5 },
  Duo: { reservations: 4, kg: 10 },
  Marmo: { reservations: 4, kg: 20 },
  "Super Héros": { reservations: 4, kg: 40 },
  "Pack 5 kg": { reservations: 1, kg: 5 },
  "Pack 10 kg": { reservations: 1, kg: 10 },
  "Recharge 5 kg": { reservations: 1, kg: 5 },
};

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

function planFromTx(tx) {
  const role = String(tx.role ?? "").trim();
  if (PLAN[role]) return role;
  const titre = String(tx.titre ?? "");
  const m =
    titre.match(/^Formule\s+(.+)$/i) ||
    titre.match(/^Renouvellement\s+(.+)$/i);
  return m ? m[1].trim() : role;
}

/** Uniquement transactions créées par le nouveau site (id doc = session ou facture Stripe). */
function isNewSiteTxDocId(docId) {
  return docId.startsWith("cs_") || docId.startsWith("inv_");
}

loadEnvLocal();
admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
  ),
});
const db = admin.firestore();

const usersSnap = await db.collection("users").get();
const users = new Map();
for (const d of usersSnap.docs) {
  const data = d.data();
  users.set(d.id, {
    email: String(data.email ?? "").toLowerCase(),
    role: data.role,
    reservations: data.reservations,
    collectes: data.collectes ?? data.kg,
  });
}

const txSnap = await db.collection("transactions").get();
const byUser = new Map();

for (const doc of txSnap.docs) {
  const tx = doc.data();
  const uid = tx.userId;
  if (!uid || !users.has(uid)) continue;
  if (tx.creditsApplied === true) continue;
  if (!isNewSiteTxDocId(doc.id)) continue;

  const plan = planFromTx(tx);
  const expected = PLAN[plan];
  if (!expected) continue;

  const u = users.get(uid);
  if (!byUser.has(uid)) {
    byUser.set(uid, {
      email: u.email,
      uid,
      role: u.role,
      reservations: u.reservations,
      collectes: u.collectes,
      pendingTxs: [],
    });
  }
  byUser.get(uid).pendingTxs.push({
    txId: doc.id,
    type: tx.type,
    plan,
    montant: tx.montant,
    expected,
  });
}

const list = [...byUser.values()];

console.log("=== Utilisateurs à incrémenter (Stripe nouveau site) ===\n");
if (list.length === 0) {
  console.log("Aucun. Tous les paiements Stripe récents ont creditsApplied.");
} else {
  for (const row of list) {
    console.log(`• ${row.email}`);
    console.log(`  UID: ${row.uid}`);
    console.log(
      `  Quotas actuels: ${row.reservations ?? "—"} collectes, ${row.collectes ?? "—"} kg`
    );
    for (const t of row.pendingTxs) {
      console.log(
        `  → ${t.txId} (${t.type}, ${t.plan}, ${t.montant ?? "?"} €) → +${t.expected.reservations} collectes, +${t.expected.kg} kg`
      );
    }
    console.log("");
  }
}

console.log(
  `Total: ${list.length} utilisateur(s), ${list.reduce((n, u) => n + u.pendingTxs.length, 0)} transaction(s).`
);

console.log("\n=== Tous les paiements nouveau site (cs_ / inv_) ===\n");
const allNew = [];
for (const doc of txSnap.docs) {
  if (!isNewSiteTxDocId(doc.id)) continue;
  const tx = doc.data();
  const u = users.get(tx.userId);
  allNew.push({
    email: u?.email ?? "(compte absent)",
    txId: doc.id,
    creditsApplied: tx.creditsApplied === true,
    type: tx.type,
    plan: planFromTx(tx),
    montant: tx.montant,
  });
}
allNew.sort((a, b) => String(a.email).localeCompare(String(b.email)));
for (const row of allNew) {
  const flag = row.creditsApplied ? "OK" : "MANQUE";
  console.log(
    `[${flag}] ${row.email} — ${row.txId.slice(0, 36)}… (${row.type}, ${row.plan}, ${row.montant ?? "?"} €)`
  );
}
