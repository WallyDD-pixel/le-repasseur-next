"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase";
import {
  STRIPE_SETTINGS_COLLECTION,
  STRIPE_SETTINGS_DOC_ID,
  type StripeSettingsFirestoreData,
} from "@/lib/stripeFirestorePaths";
import { Input, Label, PrimaryButton } from "@/components/ui/FormField";

export function StripeSettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [publishableKey, setPublishableKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [hasStoredSecret, setHasStoredSecret] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const db = getFirebaseFirestore();
    const ref = doc(db, STRIPE_SETTINGS_COLLECTION, STRIPE_SETTINGS_DOC_ID);
    getDoc(ref)
      .then(async (snap) => {
        if (!snap.exists()) {
          try {
            await setDoc(
              ref,
              {
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );
          } catch {
            setError(
              "Impossible de créer siteSettings/stripe (vérifiez les règles Firestore pour les admins)."
            );
          }
          setHasStoredSecret(false);
          setPublishableKey("");
          return;
        }
        const d = snap.data() as StripeSettingsFirestoreData;
        if (typeof d.publishableKey === "string") {
          setPublishableKey(d.publishableKey);
        }
        setHasStoredSecret(
          typeof d.secretKey === "string" && d.secretKey.trim().length > 0
        );
      })
      .catch(() => setError("Impossible de charger les paramètres Stripe."))
      .finally(() => setLoading(false));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSavedOk(false);
    setError(null);
    try {
      const db = getFirebaseFirestore();
      const ref = doc(db, STRIPE_SETTINGS_COLLECTION, STRIPE_SETTINGS_DOC_ID);
      const payload: Record<string, unknown> = {
        publishableKey: publishableKey.trim(),
        updatedAt: serverTimestamp(),
      };
      if (secretKey.trim()) {
        payload.secretKey = secretKey.trim();
        setHasStoredSecret(true);
      }
      await setDoc(ref, payload, { merge: true });
      setSecretKey("");
      setSavedOk(true);
    } catch {
      setError(
        "Enregistrement impossible. Vérifiez les règles Firestore (accès admin au document siteSettings/stripe)."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <p className="text-center text-sm text-slate-500">Chargement Stripe…</p>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-6 rounded-2xl border border-slate-200/90 bg-white/90 p-6 shadow-sm"
    >
      <div>
        <h3 className="font-lobster text-xl text-[#10294B]">
          Paiements Stripe
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Les valeurs sont enregistrées dans Firestore (
          <code className="rounded bg-slate-100 px-1 text-xs">
            {STRIPE_SETTINGS_COLLECTION}/{STRIPE_SETTINGS_DOC_ID}
          </code>
          ). La collection et le document sont créés automatiquement à la première
          ouverture de cette page (si vos règles Firestore le permettent). Limitez
          la lecture et l&apos;écriture de ce document aux comptes{" "}
          <strong>admin</strong>.
        </p>
        <div
          role="note"
          className="rounded-xl border border-amber-200 bg-amber-50/95 px-4 py-3 text-xs leading-relaxed text-amber-950"
        >
          <strong className="font-semibold">
            Important — ce que voit votre navigateur n’est pas vu par{" "}
            <code className="rounded bg-white/70 px-1 py-px">/api/checkout</code>{" "}
            sans config serveur.
          </strong>{" "}
          Si ce formulaire écrit bien dans Firestore mais le paiement affiche encore
          une erreur en local ou sur l’hébergeur, ajoutez au{" "}
          <strong>même projet</strong> que Next.js soit{" "}
          <code className="rounded bg-white/70 px-1 py-px">
            FIREBASE_SERVICE_ACCOUNT_JSON
          </code>{" "}
          (JSON du compte de service Firebase, une seule ligne) pour lecture
          serveur Firestore ; soit uniquement dans le{" "}
          <code className="rounded bg-white/70 px-1 py-px">.env</code>
          {' : '}
          <code className="rounded bg-white/70 px-1 py-px">STRIPE_SECRET_KEY</code>
          {" + "}
          <code className="rounded bg-white/70 px-1 py-px">
            STRIPE_PRICE_MINO
          </code>
          , etc. pour chaque formule.
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Les identifiants <code className="rounded bg-slate-100 px-1">price_…</code>{" "}
          (champ{" "}
          <code className="rounded bg-slate-100 px-1">stripePriceId</code> sur les
          fiches ou variables <code className="rounded bg-slate-100 px-1">STRIPE_PRICE_*</code>
          ) restent optionnels : sans eux, le checkout utilise le montant du catalogue
          site ou le champ <code className="rounded bg-slate-100 px-1">prix</code> en
          base (si le compte de service Firebase est configuré).
        </p>
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {savedOk ? (
        <p
          className="rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-900"
          role="status"
        >
          Paramètres enregistrés.
        </p>
      ) : null}

      <div className="space-y-4">
        <div>
          <Label htmlFor="stripe-pk">Clé publique Stripe (pk_…)</Label>
          <Input
            id="stripe-pk"
            name="publishableKey"
            autoComplete="off"
            value={publishableKey}
            onChange={(e) => setPublishableKey(e.target.value)}
            placeholder="pk_test_…"
          />
        </div>
        <div>
          <Label htmlFor="stripe-sk">Clé secrète (sk_…)</Label>
          <Input
            id="stripe-sk"
            name="secretKey"
            type="password"
            autoComplete="new-password"
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
            placeholder={
              hasStoredSecret
                ? "Laisser vide pour ne pas modifier la clé déjà enregistrée"
                : "sk_test_…"
            }
          />
          {hasStoredSecret ? (
            <p className="mt-1.5 text-xs text-slate-500">
              Une clé secrète est déjà stockée. Saisissez-en une nouvelle pour la
              remplacer.
            </p>
          ) : null}
        </div>
      </div>

      <PrimaryButton type="submit" loading={saving}>
        Enregistrer Stripe
      </PrimaryButton>
    </form>
  );
}
