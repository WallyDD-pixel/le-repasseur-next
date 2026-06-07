import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import Stripe from "stripe";
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

const email = (process.argv[2] || "ucolonna@yahoo.com").trim().toLowerCase();
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

const users = await db.collection("users").where("email", "==", email).get();
for (const doc of users.docs) {
  const d = doc.data();
  console.log("USER", {
    uid: doc.id,
    email: d.email,
    role: d.role,
    reservations: d.reservations,
    collectes: d.collectes,
    stripeCustomerId: d.stripeCustomerId,
    stripeSubscriptionId: d.stripeSubscriptionId,
  });

  for (const col of ["transactions", "activites"]) {
    const snap = await db.collection(col).where("userId", "==", doc.id).get();
    console.log(`\n${col.toUpperCase()} (${snap.size})`);
    const rows = snap.docs.map((t) => ({ id: t.id, ...t.data() }));
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
        montant: r.montant,
        source: r.source,
        creditsApplied: r.creditsApplied,
        stripeCheckoutSessionId: r.stripeCheckoutSessionId,
        stripeInvoiceId: r.stripeInvoiceId,
        stripeSubscriptionId: r.stripeSubscriptionId,
        createdAt: r.createdAt?.toDate?.()?.toISOString?.() ?? null,
      });
    }
  }

  // activites by email
  const actEmail = await db.collection("activites").where("email", "==", email).get();
  console.log(`\nACTIVITES_BY_EMAIL (${actEmail.size})`);
  for (const t of actEmail.docs) {
    const r = t.data();
    console.log({
      id: t.id,
      type: r.type,
      titre: r.titre,
      montant: r.montant,
      createdAt: r.createdAt?.toDate?.()?.toISOString?.() ?? null,
    });
  }
}

const sk = process.env.STRIPE_SECRET_KEY?.trim();
if (sk) {
  const stripe = new Stripe(sk);
  const invId = "in_1Tdv08GCDVPnzYlbhb3DGcZ3";
  try {
    const inv = await stripe.invoices.retrieve(invId);
    console.log("\nSTRIPE_INVOICE_OK", inv.id, inv.amount_paid, inv.customer_email);
  } catch (e) {
    console.log("\nSTRIPE_INVOICE_ERR", e instanceof Error ? e.message : e);
  }
}
