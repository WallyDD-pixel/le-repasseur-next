"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { LEGACY_ADMIN_URL } from "@/lib/adminLegacyLinks";

export default function AdminDashboardPage() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, (u) => setEmail(u?.email ?? null));
  }, []);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-10">
        <h1 className="font-lobster text-3xl text-[#10294B] sm:text-4xl">
          Tableau de bord
        </h1>
        <p className="mt-2 text-slate-600">
          {email ? (
            <>
              Connecté en tant que <strong>{email}</strong>
            </>
          ) : (
            "Espace administrateur"
          )}
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/admin/abonnements"
          className="group rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm transition hover:border-[#10294B]/25 hover:shadow-md"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-[#10294B]">
            Catalogue
          </p>
          <h2 className="mt-2 text-xl font-bold text-[#10294B]">
            Nos abonnements
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Grille des formules, modifier ou créer une fiche Firestore.
          </p>
          <span className="mt-4 inline-block text-sm font-semibold text-[#10294B] group-hover:underline">
            Ouvrir →
          </span>
        </Link>

        <Link
          href="/admin/produits"
          className="group rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm transition hover:border-[#10294B]/25 hover:shadow-md"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-[#10294B]">
            Boutique
          </p>
          <h2 className="mt-2 text-xl font-bold text-[#10294B]">
            Nos produits
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Packs, kits, options — même collection Firestore{" "}
            <code className="rounded bg-slate-50 px-1 text-[11px]">produits</code>
            .
          </p>
          <span className="mt-4 inline-block text-sm font-semibold text-[#10294B] group-hover:underline">
            Ouvrir →
          </span>
        </Link>

        <Link
          href="/admin/reservations"
          className="group rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm transition hover:border-[#10294B]/25 hover:shadow-md"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-[#10294B]">
            Réservations
          </p>
          <h2 className="mt-2 text-xl font-bold text-[#10294B]">
            Demandes de réservation
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Lecture Firestore, prise en charge et suppression — même logique que
            l&apos;ancienne vue liste.
          </p>
          <span className="mt-4 inline-block text-sm font-semibold text-[#10294B] group-hover:underline">
            Ouvrir →
          </span>
        </Link>

        <Link
          href="/admin/disponibilites"
          className="group rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm transition hover:border-[#10294B]/25 hover:shadow-md"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-[#10294B]">
            Planning
          </p>
          <h2 className="mt-2 text-xl font-bold text-[#10294B]">
            Disponibilités
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Créneaux lus depuis{" "}
            <code className="rounded bg-slate-50 px-1 text-[11px]">
              availability/availability
            </code>
            , avec fusion possible de{" "}
            <code className="rounded bg-slate-50 px-1 text-[11px]">disponibilites</code>.
          </p>
          <span className="mt-4 inline-block text-sm font-semibold text-[#10294B] group-hover:underline">
            Ouvrir →
          </span>
        </Link>

        <Link
          href="/admin/stripe"
          className="group rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm transition hover:border-[#CE2029]/30 hover:shadow-md"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-[#CE2029]">
            Configuration
          </p>
          <h2 className="mt-2 text-xl font-bold text-[#10294B]">
            Paiements Stripe
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Clés API, identifiants de prix — équivalent de la section Stripe de
            l&apos;ancienne console, stockés dans Firestore.
          </p>
          <span className="mt-4 inline-block text-sm font-semibold text-[#10294B] group-hover:underline">
            Ouvrir →
          </span>
        </Link>

        <a
          href={LEGACY_ADMIN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm transition hover:border-[#10294B]/25 hover:shadow-md"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Legacy
          </p>
          <h2 className="mt-2 text-xl font-bold text-[#10294B]">
            Ancienne console complète
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Accès direct si vous conservez encore une page HTML ou des scripts
            hors Next.js.
          </p>
          <span className="mt-4 inline-block text-sm font-semibold text-[#10294B] group-hover:underline">
            Nouvel onglet →
          </span>
        </a>
      </div>

      <p className="mt-10 rounded-xl border border-dashed border-slate-300 bg-white/60 px-5 py-4 text-sm text-slate-600">
        Les sections Messages, codes partenaires, résiliations et gestion des
        emails sont disponibles dans le menu ; le lien Legacy reste utile pour
        tout ce qui n&apos;a pas encore été déplacé ici.
      </p>
    </div>
  );
}
