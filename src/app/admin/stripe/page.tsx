"use client";

import { StripeSettingsPanel } from "@/components/admin/StripeSettingsPanel";

export default function AdminStripePage() {
  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-8">
        <h1 className="font-lobster text-3xl text-[#10294B] sm:text-4xl">
          Configuration Stripe
        </h1>
        <p className="mt-2 text-slate-600">
          Clés Stripe enregistrées dans Firestore (
          <code className="rounded bg-slate-100 px-1 text-xs">
            siteSettings/stripe
          </code>
          ). Les prix de paiement sont définis sur les fiches abonnements / produits.
        </p>
      </header>
      <StripeSettingsPanel />
    </div>
  );
}
