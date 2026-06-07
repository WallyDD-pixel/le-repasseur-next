/**
 * Audit global de l’incrémentation des crédits (reservations + collectes/kg).
 *
 * Usage :
 *   npm run audit:credits
 *   npm run audit:credits -- --json > rapport.json
 *   npm run audit:credits -- --email user@example.com
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import admin from "firebase-admin";

import { TRANSACTIONS_COLLECTION } from "../src/lib/activiteAdmin";
import { CLIENT_SUBSCRIPTION_ITEMS } from "../src/lib/clientCatalog";
import {
  findPlanOrProductData,
  PLAN_DEFAULT_CREDITS,
  resolvePlanCredits,
} from "../src/lib/planCreditsResolve";
import { isCheckoutPlanId } from "../src/lib/stripePlans";

const SUBSCRIPTION_ROLES = new Set(
  CLIENT_SUBSCRIPTION_ITEMS.map((p) => p.recapPlanId)
);

type IssueKind =
  | "credits_not_applied"
  | "stripe_renewal_missing_credits"
  | "stripe_checkout_missing_credits"
  | "legacy_log_no_credits_flag"
  | "credits_applied_no_plan"
  | "string_field"
  | "subscriber_zero_balance"
  | "duplicate_stripe_ref"
  | "paid_tx_missing_user";

type Issue = {
  kind: IssueKind;
  uid?: string;
  email?: string;
  txId?: string;
  detail: string;
  planId?: string;
  expected?: { reservations: number; kg: number };
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

function str(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  return String(v);
}

function coerceNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v.replace(",", ".").trim());
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function planIdFromTx(tx: Record<string, unknown>): string {
  const role = str(tx.role);
  if (role && (isCheckoutPlanId(role) || PLAN_DEFAULT_CREDITS[role])) {
    return role;
  }
  const titre = str(tx.titre);
  const m =
    titre.match(/^Formule\s+(.+)$/i) ||
    titre.match(/^Renouvellement\s+(.+)$/i);
  if (m?.[1]) return m[1].trim();
  return role;
}

function isNewStripeTxDocId(docId: string): boolean {
  return docId.startsWith("cs_") || docId.startsWith("inv_");
}

function isPaymentLikeTx(tx: Record<string, unknown>): boolean {
  const type = str(tx.type).toLowerCase();
  if (
    type === "abonnement" ||
    type === "renouvellement" ||
    type === "paiement" ||
    type === "subscription"
  ) {
    return true;
  }
  if (str(tx.stripeCheckoutSessionId) || str(tx.stripeInvoiceId)) return true;
  if (typeof tx.montant === "number" && tx.montant > 0) return true;
  return false;
}

function isStringField(v: unknown): boolean {
  return typeof v === "string" && v.trim() !== "";
}

async function main() {
  loadEnvLocal();

  const args = process.argv.slice(2);
  const jsonOut = args.includes("--json");
  const emailFilterArg = args.find((a) => a.startsWith("--email="));
  const emailFilter = emailFilterArg
    ? emailFilterArg.split("=")[1]?.trim().toLowerCase()
    : args.includes("--email")
      ? args[args.indexOf("--email") + 1]?.trim().toLowerCase()
      : undefined;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) {
    console.error("FIREBASE_SERVICE_ACCOUNT_JSON manquant dans .env.local");
    process.exit(1);
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(raw)),
    });
  }

  const db = admin.firestore();
  const issues: Issue[] = [];

  console.log("Chargement des utilisateurs…");
  const usersSnap = await db.collection("users").get();
  const users = new Map<
    string,
    { email: string; role: string; reservations: unknown; collectes: unknown }
  >();

  for (const doc of usersSnap.docs) {
    const d = doc.data() as Record<string, unknown>;
    const email = str(d.email).toLowerCase();
    if (emailFilter && email !== emailFilter) continue;
    users.set(doc.id, {
      email,
      role: str(d.role),
      reservations: d.reservations,
      collectes: d.collectes ?? d.kg ?? d.collectes,
    });
  }

  console.log(`Utilisateurs analysés : ${users.size}`);

  console.log("Chargement des transactions…");
  const txSnap = await db.collection(TRANSACTIONS_COLLECTION).get();
  console.log(`Transactions totales : ${txSnap.size}`);

  const stripeRefIndex = new Map<string, string[]>();

  let creditsAppliedCount = 0;
  let paymentLikeCount = 0;
  let missingCreditsCount = 0;

  for (const doc of txSnap.docs) {
    const tx = doc.data() as Record<string, unknown>;
    const uid = str(tx.userId);
    if (!uid) continue;
    if (emailFilter) {
      const u = users.get(uid);
      if (!u || u.email !== emailFilter) continue;
    }

    const planId = planIdFromTx(tx);
    const amountEuros =
      typeof tx.montant === "number" ? tx.montant : null;
    const paymentLike = isPaymentLikeTx(tx);
    const creditsApplied = tx.creditsApplied === true;

    if (paymentLike) paymentLikeCount++;

    for (const key of ["stripeCheckoutSessionId", "stripeInvoiceId"] as const) {
      const ref = str(tx[key]);
      if (!ref) continue;
      const mapKey = `${key}:${ref}`;
      const list = stripeRefIndex.get(mapKey) ?? [];
      list.push(doc.id);
      stripeRefIndex.set(mapKey, list);
    }

    if (!users.has(uid) && paymentLike) {
      issues.push({
        kind: "paid_tx_missing_user",
        uid,
        txId: doc.id,
        detail: "Transaction paiement sans utilisateur Firestore correspondant.",
        planId,
      });
      continue;
    }

    const user = users.get(uid);
    if (!user) continue;

    if (paymentLike && !creditsApplied) {
      const planData = await findPlanOrProductData(db, planId, amountEuros);
      const { addReservations, addKg } = resolvePlanCredits(planId, planData);
      if (addReservations != null || addKg != null) {
        missingCreditsCount++;
        const isNewStripe =
          isNewStripeTxDocId(doc.id) ||
          str(tx.stripeCheckoutSessionId).startsWith("cs_") ||
          str(tx.stripeInvoiceId).startsWith("in_");
        const kind: IssueKind = isNewStripeTxDocId(doc.id)
          ? doc.id.startsWith("inv_")
            ? "stripe_renewal_missing_credits"
            : "stripe_checkout_missing_credits"
          : isNewStripe
            ? "credits_not_applied"
            : "legacy_log_no_credits_flag";

        issues.push({
          kind,
          uid,
          email: user.email,
          txId: doc.id,
          planId,
          expected: {
            reservations: addReservations ?? 0,
            kg: addKg ?? 0,
          },
          detail: `Paiement enregistré mais creditsApplied ≠ true (type=${str(tx.type)}, montant=${amountEuros ?? "—"}).`,
        });
      }
    }

    if (creditsApplied) {
      creditsAppliedCount++;
      const planData = await findPlanOrProductData(db, planId, amountEuros);
      const { addReservations, addKg } = resolvePlanCredits(planId, planData);
      if (addReservations == null && addKg == null) {
        issues.push({
          kind: "credits_applied_no_plan",
          uid,
          email: user.email,
          txId: doc.id,
          planId: planId || "—",
          detail:
            "Transaction marquée creditsApplied mais plan introuvable / crédits non résolus.",
        });
      }
    }
  }

  for (const [mapKey, ids] of stripeRefIndex) {
    if (ids.length <= 1) continue;
    issues.push({
      kind: "duplicate_stripe_ref",
      txId: ids.join(", "),
      detail: `Référence Stripe en double (${mapKey}) sur ${ids.length} documents.`,
    });
  }

  let stringFieldCount = 0;
  let subscriberZeroCount = 0;

  for (const [uid, user] of users) {
    if (isStringField(user.reservations) || isStringField(user.collectes)) {
      stringFieldCount++;
      issues.push({
        kind: "string_field",
        uid,
        email: user.email,
        detail: `Champ numérique stocké en chaîne (reservations=${JSON.stringify(user.reservations)}, collectes=${JSON.stringify(user.collectes)}).`,
      });
    }

    if (SUBSCRIPTION_ROLES.has(user.role)) {
      const res = coerceNum(user.reservations);
      const kg = coerceNum(user.collectes);
      if (res <= 0 && kg <= 0) {
        subscriberZeroCount++;
        issues.push({
          kind: "subscriber_zero_balance",
          uid,
          email: user.email,
          planId: user.role,
          detail: `Abonné « ${user.role} » mais quotas à zéro (reservations=${res}, collectes/kg=${kg}).`,
        });
      }
    }
  }

  const byKind = (kind: IssueKind) => issues.filter((i) => i.kind === kind);

  const summary = {
    scannedAt: new Date().toISOString(),
    users: users.size,
    transactions: txSnap.size,
    paymentLikeTransactions: paymentLikeCount,
    creditsAppliedTransactions: creditsAppliedCount,
    missingCreditsOnPaymentTx: missingCreditsCount,
    issuesTotal: issues.length,
    byKind: {
      stripe_checkout_missing_credits: byKind("stripe_checkout_missing_credits")
        .length,
      stripe_renewal_missing_credits: byKind("stripe_renewal_missing_credits")
        .length,
      legacy_log_no_credits_flag: byKind("legacy_log_no_credits_flag").length,
      credits_not_applied: byKind("credits_not_applied").length,
      credits_applied_no_plan: byKind("credits_applied_no_plan").length,
      string_field: stringFieldCount,
      subscriber_zero_balance: subscriberZeroCount,
      duplicate_stripe_ref: byKind("duplicate_stripe_ref").length,
      paid_tx_missing_user: byKind("paid_tx_missing_user").length,
    },
    issues,
  };

  if (jsonOut) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log("\n========== AUDIT INCRÉMENTATION CRÉDITS ==========\n");
  console.log(`Utilisateurs       : ${summary.users}`);
  console.log(`Transactions       : ${summary.transactions}`);
  console.log(`Tx type paiement   : ${summary.paymentLikeTransactions}`);
  console.log(`Tx creditsApplied  : ${summary.creditsAppliedTransactions}`);
  console.log(`Tx sans crédits    : ${summary.missingCreditsOnPaymentTx}`);
  console.log(`Anomalies totales  : ${summary.issuesTotal}\n`);

  const labels: Record<IssueKind, string> = {
    stripe_checkout_missing_credits:
      "NOUVEAU SITE — checkout Stripe sans crédits",
    stripe_renewal_missing_credits:
      "NOUVEAU SITE — renouvellement webhook sans crédits",
    legacy_log_no_credits_flag:
      "ANCIEN SITE — journal legacy sans flag creditsApplied",
    credits_not_applied: "Paiement sans incrémentation (autre)",
    credits_applied_no_plan: "Crédits appliqués mais plan inconnu",
    string_field: "Champ quota en chaîne (risque increment)",
    subscriber_zero_balance: "Abonné actif mais quotas à 0",
    duplicate_stripe_ref: "Doublon référence Stripe",
    paid_tx_missing_user: "Transaction sans utilisateur (compte supprimé)",
  };

  for (const kind of Object.keys(labels) as IssueKind[]) {
    const rows = byKind(kind);
    if (rows.length === 0) continue;
    console.log(`--- ${labels[kind]} (${rows.length}) ---`);
    for (const row of rows.slice(0, 30)) {
      const who = row.email || row.uid || "—";
      const tx = row.txId ? ` [${row.txId.slice(0, 24)}…]` : "";
      const plan = row.planId ? ` plan=${row.planId}` : "";
      const exp =
        row.expected != null
          ? ` attendu +${row.expected.reservations} collectes / +${row.expected.kg} kg`
          : "";
      console.log(`  • ${who}${tx}${plan}${exp}`);
      console.log(`    ${row.detail}`);
    }
    if (rows.length > 30) {
      console.log(`  … et ${rows.length - 30} autre(s)`);
    }
    console.log("");
  }

  const outPath = resolve(process.cwd(), "audit-credits-report.json");
  writeFileSync(outPath, JSON.stringify(summary, null, 2), "utf8");
  console.log(`Rapport JSON : ${outPath}`);
  console.log("Relancer avec --json pour stdout uniquement.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
