"use client";

import { AbonnementForm } from "@/components/admin/AbonnementForm";

export default function NouvelAbonnementPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-8">
        <p className="text-xs font-bold uppercase tracking-wider text-[#CE2029]">
          Création
        </p>
        <h1 className="font-lobster text-3xl text-[#10294B] sm:text-4xl">
          Nouvel abonnement
        </h1>
        <p className="mt-2 text-slate-600">
          Renseignez les champs puis enregistrez — document dans la collection{" "}
          <code className="rounded bg-slate-100 px-1 text-xs">abonnements</code>
          .
        </p>
      </header>
      <AbonnementForm mode="create" />
    </div>
  );
}
