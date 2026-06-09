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
if (!saJson) {
  console.error("FIREBASE_SERVICE_ACCOUNT_JSON manquant");
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(saJson)),
  });
}
const db = admin.firestore();

const needle = (process.argv[2] || "gwen").toLowerCase();
const users = await db.collection("users").get();
const matches = [];

for (const doc of users.docs) {
  const x = doc.data();
  const prenom = String(x.prenom || "").toLowerCase();
  const nom = String(x.nom || "").toLowerCase();
  const email = String(x.email || "").toLowerCase();
  if (
    prenom.includes(needle) ||
    nom.includes(needle) ||
    email.includes(needle)
  ) {
    matches.push({ uid: doc.id, ...x });
  }
}

console.log(`Found ${matches.length} user(s) for "${needle}"`);
for (const u of matches) {
  console.log("\n=== USER ===");
  console.log({
    uid: u.uid,
    email: u.email,
    prenom: u.prenom,
    nom: u.nom,
    role: u.role,
    collectes: u.collectes,
    reservations: u.reservations,
    stripeCustomerId: u.stripeCustomerId,
  });

  const txSnap = await db
    .collection("transactions")
    .where("userId", "==", u.uid)
    .get();
  console.log(`\nTRANSACTIONS (${txSnap.size})`);
  const rows = txSnap.docs.map((t) => ({ id: t.id, ...t.data() }));
  rows.sort((a, b) => {
    const da = a.createdAt?.toDate?.()?.getTime?.() ?? 0;
    const db2 = b.createdAt?.toDate?.()?.getTime?.() ?? 0;
    return db2 - da;
  });
  for (const r of rows) {
    console.log({
      id: r.id,
      type: r.type,
      titre: r.titre,
      role: r.role,
      montant: r.montant,
      creditsApplied: r.creditsApplied,
      source: r.source,
      createdAt: r.createdAt?.toDate?.()?.toISOString?.() ?? null,
    });
  }
}
