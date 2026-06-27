/**
 * Historique complet Marin — quotas, transactions, activité, réservations.
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

function fmtTs(raw) {
  if (!raw) return "—";
  if (raw.toDate) return raw.toDate().toISOString().replace("T", " ").slice(0, 19);
  if (raw._seconds) return new Date(raw._seconds * 1000).toISOString().replace("T", " ").slice(0, 19);
  return String(raw);
}

loadEnvLocal();
admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
  ),
});
const db = admin.firestore();

const email = "marin.matic74@gmail.com";
const users = await db.collection("users").where("email", "==", email).get();
if (users.empty) {
  console.error("Utilisateur introuvable");
  process.exit(1);
}
const uid = users.docs[0].id;
const user = users.docs[0].data();

console.log("=".repeat(70));
console.log("UTILISATEUR", email);
console.log("UID:", uid);
console.log("=".repeat(70));
console.log("\n--- État actuel (doc users) ---");
console.log({
  role: user.role,
  collectes: user.collectes,
  kg: user.kg,
  reservations: user.reservations,
  stripeCustomerId: user.stripeCustomerId,
  stripeSubscriptionId: user.stripeSubscriptionId,
  createdAt: fmtTs(user.createdAt),
  updatedAt: fmtTs(user.updatedAt),
  dateInscription: fmtTs(user.dateInscription),
});

// Toutes les transactions (tri date)
console.log("\n--- Transactions (chronologique) ---");
const txSnap = await db.collection("transactions").where("userId", "==", uid).get();
const txs = txSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
txs.sort((a, b) => {
  const da = a.transactionDate || a.createdAt;
  const db_ = b.transactionDate || b.createdAt;
  const ta = da?._seconds ?? da?.toDate?.()?.getTime?.() ?? 0;
  const tb = db_?._seconds ?? db_?.toDate?.()?.getTime?.() ?? 0;
  return ta - tb;
});
for (const t of txs) {
  console.log(`\n[${fmtTs(t.transactionDate || t.createdAt)}] ${t.id}`);
  console.log({
    type: t.type,
    titre: t.titre || t.title,
    role: t.role,
    montant: t.montant,
    creditsApplied: t.creditsApplied,
    source: t.source,
    stripeCheckoutSessionId: t.stripeCheckoutSessionId,
    stripeInvoiceId: t.stripeInvoiceId,
    stripeSubscriptionId: t.stripeSubscriptionId,
  });
}

// Activités
console.log("\n--- Collection activites ---");
const actSnap = await db.collection("activites").get();
const acts = actSnap.docs
  .map((d) => ({ id: d.id, ...d.data() }))
  .filter(
    (a) =>
      String(a.email ?? "").toLowerCase() === email ||
      String(a.userId ?? "") === uid ||
      String(a.client ?? "").toLowerCase().includes("matic") ||
      String(a.client ?? "").toLowerCase().includes("marin")
  );
acts.sort((a, b) => {
  const ta = (a.createdAt?._seconds ?? a.date?._seconds ?? 0);
  const tb = (b.createdAt?._seconds ?? b.date?._seconds ?? 0);
  return ta - tb;
});
if (acts.length === 0) console.log("(aucune entrée trouvée)");
for (const a of acts) {
  console.log(`\n[${fmtTs(a.date || a.createdAt)}] ${a.id}`);
  console.log({
    type: a.type,
    titre: a.titre || a.title,
    montant: a.montant,
    abonnement: a.abonnement,
    client: a.client,
  });
}

// Réservations
console.log("\n--- Demandes de réservation ---");
const resIds = new Map();
for (const field of ["userid", "userId", "uid"]) {
  const snap = await db.collection("demande de reservation").where(field, "==", uid).get();
  snap.forEach((d) => resIds.set(d.id, d.data()));
}
const reservations = [...resIds.entries()].map(([id, data]) => ({ id, ...data }));
reservations.sort((a, b) => {
  const sa = String(a.heureReservation ?? a.dateHeureReservation ?? "");
  const sb = String(b.heureReservation ?? b.dateHeureReservation ?? "");
  return sa.localeCompare(sb);
});
for (const r of reservations) {
  console.log(`\n[${r.dateHeureReservation || r.heureReservation}] ${r.id}`);
  console.log({
    etat: r.etat,
    kg: r.kg,
    role: r.role,
    activite: r.activite,
    numeroCommande: r.numeroCommande,
  });
}

// Sous-collections user
console.log("\n--- Sous-collections users/{uid} ---");
const subcols = await db.collection("users").doc(uid).listCollections();
if (subcols.length === 0) console.log("(aucune sous-collection)");
for (const col of subcols) {
  const snap = await col.get();
  console.log(`\n${col.id} (${snap.size} docs)`);
  snap.docs.slice(0, 20).forEach((d) => console.log(" ", d.id, JSON.stringify(d.data())));
}

// Historique / audit / logs
console.log("\n--- Autres collections (email ou uid) ---");
const collectionsToScan = [
  "historique",
  "history",
  "audit",
  "logs",
  "userHistory",
  "quotaHistory",
  "creditHistory",
  "modifications",
];

for (const colName of collectionsToScan) {
  try {
    const snap = await db.collection(colName).limit(500).get();
    const hits = snap.docs.filter((d) => {
      const x = d.data();
      const blob = JSON.stringify(x).toLowerCase();
      return blob.includes(uid.toLowerCase()) || blob.includes(email) || blob.includes("matic");
    });
    if (hits.length > 0) {
      console.log(`\n${colName} (${hits.length} hit(s)):`);
      hits.forEach((d) => console.log(" ", d.id, JSON.stringify(d.data()).slice(0, 400)));
    }
  } catch {
    /* collection absente */
  }
}

// Recherche champs historiques dans users
console.log("\n--- Tous les champs users (quota / historique) ---");
const quotaKeys = Object.keys(user).filter((k) =>
  /collect|kg|reserv|quota|credit|histor|log|modif|stripe|role|abonn/i.test(k)
);
const subset = {};
for (const k of quotaKeys) subset[k] = user[k];
console.log(JSON.stringify(subset, null, 2));

console.log("\n--- Synthèse chronologique (événements liés aux quotas) ---");
const timeline = [];

for (const t of txs) {
  timeline.push({
    date: fmtTs(t.transactionDate || t.createdAt),
    event: `${t.type || "?"} — ${t.titre || t.title || t.role || t.id}`,
    creditsApplied: t.creditsApplied,
    montant: t.montant,
  });
}
for (const r of reservations) {
  timeline.push({
    date: r.dateHeureReservation || fmtTs(r.heureReservation),
    event: `Réservation ${r.kg} kg — ${r.etat}`,
    creditsApplied: "—",
    montant: "—",
  });
}
timeline.sort((a, b) => String(a.date).localeCompare(String(b.date)));
for (const e of timeline) {
  console.log(`${e.date} | ${e.event} | crédits: ${e.creditsApplied} | ${e.montant ?? ""}`);
}
