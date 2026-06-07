/**
 * Ajoute une transaction de test dans Firestore pour tester les factures PDF.
 *
 * Usage :
 *   node scripts/seed-test-transaction.mjs
 *   node scripts/seed-test-transaction.mjs wallydibombepro22@gmail.com
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import admin from "firebase-admin";

const TRANSACTIONS = "transactions";
const TEST_DOC_ID = "test_facture_demo_001";
const DEFAULT_EMAIL = "wallydibombepro22@gmail.com";

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

async function main() {
  loadEnvLocal();

  const email = (process.argv[2] || DEFAULT_EMAIL).trim().toLowerCase();
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) {
    console.error(
      "FIREBASE_SERVICE_ACCOUNT_JSON manquant dans .env.local"
    );
    process.exit(1);
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(raw)),
    });
  }

  const db = admin.firestore();
  const users = await db
    .collection("users")
    .where("email", "==", email)
    .limit(1)
    .get();

  if (users.empty) {
    console.error(`Aucun utilisateur Firestore avec l'email : ${email}`);
    process.exit(1);
  }

  const userDoc = users.docs[0];
  const uid = userDoc.id;
  const userData = userDoc.data();
  const display =
    [userData.prenom, userData.nom].filter(Boolean).join(" ") || email;

  const now = admin.firestore.FieldValue.serverTimestamp();
  const payload = {
    userId: uid,
    type: "abonnement",
    titre: "Formule Mino (test facture)",
    role: "Mino",
    montant: 19,
    currency: "eur",
    transactionDate: now,
    createdAt: now,
    source: "test_seed",
    creditsApplied: true,
    invoiceNumber: "FAC-TEST-2026-001",
    stripeInvoiceId: "in_TEST_DEMO_WALLY",
  };

  await db.collection(TRANSACTIONS).doc(TEST_DOC_ID).set(payload, { merge: true });

  console.log("Transaction de test créée.");
  console.log(`  Email    : ${email}`);
  console.log(`  Client   : ${display}`);
  console.log(`  UID      : ${uid}`);
  console.log(`  Doc ID   : ${TEST_DOC_ID}`);
  console.log(`  Montant  : 19 € — Mino (test)`);
  console.log("");
  console.log(
    "Connectez-vous sur /espace-client avec ce compte, puis « PDF Le Repasseur »."
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
