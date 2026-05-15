/**
 * Aligne Firestore sur les abonnements Stripe actifs.
 *
 * Prérequis : .env.local avec FIREBASE_SERVICE_ACCOUNT_JSON et STRIPE_SECRET_KEY
 *
 *   npm run sync:stripe              # aperçu (dry-run)
 *   npm run sync:stripe -- --apply     # écriture Firestore
 *   npm run sync:stripe -- --apply --no-set-quotas   # rôle + transaction seulement
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import * as admin from "firebase-admin";
import Stripe from "stripe";

import { syncStripeSubscribers } from "../src/lib/syncStripeSubscribers";

function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

function initFirebase(): admin.firestore.Firestore {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) {
    console.error(
      "FIREBASE_SERVICE_ACCOUNT_JSON manquant (.env.local ou variable d’environnement)."
    );
    process.exit(1);
  }
  if (!admin.apps.length) {
    const cred = JSON.parse(raw) as admin.ServiceAccount;
    admin.initializeApp({ credential: admin.credential.cert(cred) });
  }
  return admin.firestore();
}

function printRow(
  r: Awaited<ReturnType<typeof syncStripeSubscribers>>["rows"][number]
): void {
  const parts = [
    r.outcome.padEnd(16),
    r.subscriptionId,
    r.planId || "—",
    r.email || "—",
    r.uid || "—",
  ];
  console.log(parts.join(" | "));
  if (r.message) console.log(`  → ${r.message}`);
  if (r.changes && r.outcome === "updated") {
    console.log(`  → changements : ${JSON.stringify(r.changes)}`);
    if (r.before) console.log(`  → avant       : ${JSON.stringify(r.before)}`);
  }
}

async function main(): Promise<void> {
  const root = process.cwd();
  loadEnvFile(join(root, ".env.local"));
  loadEnvFile(join(root, ".env"));

  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const setQuotas = !args.includes("--no-set-quotas");

  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!stripeKey) {
    console.error("STRIPE_SECRET_KEY manquant.");
    process.exit(1);
  }

  const db = initFirebase();
  const stripe = new Stripe(stripeKey);

  console.log(
    apply
      ? "Mode APPLY — écriture Firestore activée."
      : "Mode DRY-RUN — aucune écriture (ajoutez --apply pour appliquer)."
  );
  console.log(setQuotas ? "Quotas : réinitialisation aux valeurs du plan." : "Quotas : inchangés (rôle + transaction seulement).\n");

  const result = await syncStripeSubscribers(stripe, db, {
    dryRun: !apply,
    setQuotas,
  });

  console.log(`\nAbonnements scannés : ${result.scanned}\n`);
  for (const row of result.rows) printRow(row);

  console.log("\nRésumé :", result.summary);
  if (!apply && result.summary.updated > 0) {
    console.log(
      `\n${result.summary.updated} compte(s) à mettre à jour. Relancez avec : npm run sync:stripe -- --apply`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
