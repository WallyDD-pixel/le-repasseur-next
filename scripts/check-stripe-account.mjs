/**
 * Diagnostic compte Stripe (sans CLI Stripe).
 *
 * Usage PowerShell :
 *   $env:STRIPE_LIVE_CHECK = "sk_live_..."
 *   npm run check:stripe
 *
 * Ou avec .env.local (STRIPE_SECRET_KEY) :
 *   npm run check:stripe
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import Stripe from "stripe";

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

const sk =
  process.env.STRIPE_LIVE_CHECK?.trim() ||
  process.env.STRIPE_SECRET_KEY?.trim();

if (!sk) {
  console.error(
    "Clé manquante. Définissez STRIPE_LIVE_CHECK ou STRIPE_SECRET_KEY.\n" +
      'Ex. : $env:STRIPE_LIVE_CHECK = "sk_live_..." puis npm run check:stripe'
  );
  process.exit(1);
}

const mode = sk.startsWith("sk_live")
  ? "live"
  : sk.startsWith("sk_test")
    ? "test"
    : "inconnu";

console.log("Mode clé :", mode);
console.log("Préfixe  :", sk.slice(0, 16) + "…\n");

const stripe = new Stripe(sk);

try {
  const acc = await stripe.accounts.retrieve();
  const out = {
    id: acc.id,
    email: acc.email ?? null,
    country: acc.country ?? null,
    charges_enabled: acc.charges_enabled,
    payouts_enabled: acc.payouts_enabled,
    details_submitted: acc.details_submitted,
    disabled_reason: acc.requirements?.disabled_reason ?? null,
    currently_due: acc.requirements?.currently_due ?? [],
  };
  console.log(JSON.stringify(out, null, 2));

  if (mode === "live" && !acc.charges_enabled) {
    console.error(
      "\n→ Paiements LIVE bloqués sur CE compte (message Checkout probable)."
    );
    process.exit(2);
  }
  if (mode === "live" && acc.charges_enabled) {
    console.log("\n→ Compte LIVE OK pour encaisser (vérifiez aussi les price_… live).");
  }
} catch (e) {
  console.error("Erreur Stripe :", e instanceof Error ? e.message : e);
  process.exit(1);
}
