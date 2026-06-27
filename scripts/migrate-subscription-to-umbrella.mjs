/**
 * Migre un abonnement vers le compte Stripe Umbrella (siteSettings).
 * Usage: node scripts/migrate-subscription-to-umbrella.mjs claire.desclercs@gmail.com Solo
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import Stripe from "stripe";
import admin from "firebase-admin";

const EMAIL = process.argv[2]?.trim().toLowerCase();
const PLAN_ID = process.argv[3]?.trim() || "Solo";
/** Fin de période déjà payée sur l'ancien compte (évite double facturation). */
const TRIAL_END_ISO = process.argv[4] || "2026-06-18T12:00:00+02:00";

if (!EMAIL) {
  console.error(
    "Usage: node scripts/migrate-subscription-to-umbrella.mjs <email> [planId] [trialEndISO]"
  );
  process.exit(1);
}

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
const settings = (await db.collection("siteSettings").doc("stripe").get()).data();
const stripe = new Stripe(settings.secretKey.trim());

const usersSnap = await db.collection("users").where("email", "==", EMAIL).get();
if (usersSnap.empty) {
  console.error("Utilisateur introuvable:", EMAIL);
  process.exit(1);
}
const userDoc = usersSnap.docs[0];
const uid = userDoc.id;
const userData = userDoc.data();

console.log("Utilisateur:", EMAIL, "| uid:", uid);
console.log("Rôle actuel:", userData.role, "| kg:", userData.collectes);

// Déjà sur Umbrella ?
const existingSub = userData.stripeSubscriptionId;
if (
  typeof existingSub === "string" &&
  existingSub.startsWith("sub_") &&
  existingSub.includes("GCDVP")
) {
  console.log("Abonnement Umbrella déjà présent:", existingSub);
  const sub = await stripe.subscriptions.retrieve(existingSub);
  console.log("Statut:", sub.status);
  process.exit(0);
}

// Prix Solo depuis Firestore abonnements
async function resolvePriceId(planId) {
  const settingsSnap = await db.collection("siteSettings").doc("stripe").get();
  const pricesMap = settingsSnap.data()?.prices;
  if (pricesMap && typeof pricesMap[planId] === "string") {
    const id = pricesMap[planId].trim();
    if (id.startsWith("price_")) {
      const p = await stripe.prices.retrieve(id);
      if (p.active) return id;
    }
  }

  const envMap = {
    Solo: process.env.STRIPE_PRICE_SOLO,
    Mino: process.env.STRIPE_PRICE_MINO,
    Duo: process.env.STRIPE_PRICE_DUO,
    Marmo: process.env.STRIPE_PRICE_MARMO,
    "Super Héros": process.env.STRIPE_PRICE_SUPER_HEROS,
  };
  const fromEnv = envMap[planId]?.trim();
  if (fromEnv?.startsWith("price_")) {
    const p = await stripe.prices.retrieve(fromEnv);
    if (p.active) return fromEnv;
  }

  const aboSnap = await db.collection("abonnements").get();
  for (const d of aboSnap.docs) {
    const data = d.data();
    const name = String(data.nom ?? data.name ?? data.role ?? "").trim();
    const recap = String(data.recapPlanId ?? "").trim();
    if (name !== planId && recap !== planId && d.id !== planId) continue;
    for (const k of ["stripePriceId", "stripe_price_id", "stripePrice"]) {
      const v = data[k];
      if (typeof v === "string" && v.startsWith("price_")) {
        const p = await stripe.prices.retrieve(v.trim());
        if (p.active) return v.trim();
      }
    }
  }

  const amounts = { Solo: 3900, Mino: 1900, Duo: 5900, Marmo: 9900, "Super Héros": 19900 };
  const cents = amounts[planId];
  if (!cents) return null;

  const product = await stripe.products.create({
    name: `Abonnement ${planId} — Le Repasseur`,
    active: true,
    metadata: { planId, recapPlanId: planId },
  });
  const created = await stripe.prices.create({
    product: product.id,
    unit_amount: cents,
    currency: "eur",
    recurring: { interval: "month" },
    nickname: planId,
    metadata: { planId, recapPlanId: planId },
  });
  console.log("Produit + price actifs créés:", product.id, created.id);
  await db.collection("siteSettings").doc("stripe").set(
    {
      prices: { [planId]: created.id },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  return created.id;
}

const priceId = await resolvePriceId(PLAN_ID);
if (!priceId) {
  console.error("Prix Stripe introuvable pour", PLAN_ID);
  process.exit(1);
}
console.log("Price ID Umbrella:", priceId);

// Client Stripe Umbrella
let customerId = userData.stripeCustomerId;
if (customerId?.startsWith("cus_") && customerId.includes("GCDVP")) {
  console.log("Client Umbrella existant:", customerId);
} else {
  const existing = await stripe.customers.list({ email: EMAIL, limit: 10 });
  const umb = existing.data.find((c) => c.id.includes("GCDVP"));
  if (umb) {
    customerId = umb.id;
    console.log("Client trouvé par email:", customerId);
  } else if (existing.data.length > 0) {
    customerId = existing.data[0].id;
    console.log("Client réutilisé:", customerId);
  } else {
    const c = await stripe.customers.create({
      email: EMAIL,
      name: [userData.prenom, userData.nom].filter(Boolean).join(" ").trim() || undefined,
      phone: userData.telephone || undefined,
      metadata: {
        firebaseUid: uid,
        migratedFrom: userData.stripeSubscriptionId || "legacy_stripe_account",
      },
    });
    customerId = c.id;
    console.log("Nouveau client créé:", customerId);
  }
}

const trialEnd = Math.floor(new Date(TRIAL_END_ISO).getTime() / 1000);
const now = Math.floor(Date.now() / 1000);
const subParams = {
  customer: customerId,
  items: [{ price: priceId }],
  metadata: {
    planId: PLAN_ID,
    firebaseUid: uid,
    migratedAt: new Date().toISOString(),
  },
};
if (trialEnd > now + 3600) {
  subParams.trial_end = trialEnd;
  console.log(
    "Essai jusqu'au",
    new Date(trialEnd * 1000).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })
  );
}

const sub = await stripe.subscriptions.create(subParams);
console.log("Abonnement Umbrella créé:", sub.id, "| statut:", sub.status);

// Firestore
const oldSubId = userData.stripeSubscriptionId;
await db.collection("users").doc(uid).set(
  {
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
    role: PLAN_ID,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    stripeMigrationNote: `Migré depuis ${oldSubId || "ancien compte"} le ${new Date().toISOString()}`,
  },
  { merge: true }
);

const txId = `migration_${sub.id}`;
await db.collection("transactions").doc(txId).set(
  {
    userId: uid,
    type: "abonnement",
    titre: `Migration ${PLAN_ID} (compte Umbrella)`,
    role: PLAN_ID,
    montant: sub.items.data[0]?.price?.unit_amount
      ? sub.items.data[0].price.unit_amount / 100
      : 39,
    currency: "eur",
    stripeSubscriptionId: sub.id,
    stripeCustomerId: customerId,
    previousStripeSubscriptionId: oldSubId || null,
    source: "admin_migration",
    creditsApplied: false,
    transactionDate: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  },
  { merge: true }
);

console.log("\n✅ Migration terminée");
console.log({
  email: EMAIL,
  uid,
  stripeCustomerId: customerId,
  stripeSubscriptionId: sub.id,
  ancienSub: oldSubId || "(dans transaction seulement)",
});
console.log(
  "\n⚠️  Annulez manuellement l'abonnement sur l'ANCIEN compte Stripe:",
  oldSubId || "sub_1TYQjIBCi4CMCVLuXOdBjLTK"
);
