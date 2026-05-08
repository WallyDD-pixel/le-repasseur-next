"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  addDoc,
  collection,
  deleteField,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { Input, Label, PrimaryButton } from "@/components/ui/FormField";
import {
  ABONNEMENTS_COLLECTION,
  type AbonnementFormValues,
  serializePrixForFirestore,
  uploadAbonnementCoverImage,
} from "@/lib/abonnementsAdmin";
import { getFirebaseFirestore } from "@/lib/firebase";

const textareaClass =
  "w-full min-h-[160px] rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none ring-[#CE2029]/20 transition placeholder:text-slate-400 focus:border-[#CE2029]/50 focus:ring-4";

export function AbonnementForm({
  mode,
  documentId,
  initial,
}: {
  mode: "create" | "edit";
  documentId?: string;
  initial?: AbonnementFormValues & { imageUrl?: string };
}) {
  const router = useRouter();
  const [nom, setNom] = useState(initial?.nom ?? "");
  const [prix, setPrix] = useState(initial?.prix ?? "");
  const [stripePriceId, setStripePriceId] = useState(
    initial?.stripePriceId ?? ""
  );
  const [description, setDescription] = useState(initial?.description ?? "");
  const [avantages, setAvantages] = useState(initial?.avantages ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!nom.trim()) {
      setError("Le nom est obligatoire.");
      return;
    }
    setPending(true);
    try {
      const db = getFirebaseFirestore();
      const col = collection(db, ABONNEMENTS_COLLECTION);

      const payload: Record<string, unknown> = {
        nom: nom.trim(),
        description: description.trim(),
        avantages: avantages.trim(),
        updatedAt: serverTimestamp(),
      };
      const p = serializePrixForFirestore(prix);
      if (p !== undefined) payload.prix = p;

      const sid = stripePriceId.trim();
      if (sid) {
        payload.stripePriceId = sid;
      } else if (mode === "edit") {
        payload.stripePriceId = deleteField();
      }

      let targetId = documentId;

      if (mode === "create") {
        const ref = await addDoc(col, payload);
        targetId = ref.id;
      } else if (documentId) {
        await updateDoc(doc(db, ABONNEMENTS_COLLECTION, documentId), payload);
        targetId = documentId;
      }

      if (file && targetId) {
        const url = await uploadAbonnementCoverImage(targetId, file);
        await updateDoc(doc(db, ABONNEMENTS_COLLECTION, targetId), {
          image: url,
          updatedAt: serverTimestamp(),
        });
        setImageUrl(url);
        setFile(null);
      }

      router.push("/admin/abonnements");
      router.refresh();
    } catch {
      setError(
        "Enregistrement impossible. Vérifiez Firestore / Storage et vos droits admin."
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-6 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm sm:p-8"
    >
      {error ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div>
        <Label htmlFor="nom">Nom</Label>
        <Input
          id="nom"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          required
          autoComplete="off"
        />
      </div>

      <div>
        <Label htmlFor="prix">
          Prix (nombre mensuel, ex. 59 → affiché 59€/mois)
        </Label>
        <Input
          id="prix"
          inputMode="decimal"
          value={prix}
          onChange={(e) => setPrix(e.target.value)}
          placeholder="59"
          autoComplete="off"
        />
      </div>

      <div>
        <Label htmlFor="stripePriceId">
          ID prix Stripe (optionnel, <code className="text-xs">price_…</code>)
        </Label>
        <Input
          id="stripePriceId"
          value={stripePriceId}
          onChange={(e) => setStripePriceId(e.target.value)}
          placeholder="price_…"
          autoComplete="off"
        />
        <p className="mt-1 text-xs text-slate-500">
          Utilisé au paiement si le document correspond au plan (même{" "}
          <code className="rounded bg-slate-100 px-1">nom</code> ou champ{" "}
          <code className="rounded bg-slate-100 px-1">recapPlanId</code>
          ). Le montant ci-dessus reste l&apos;affichage catalogue ; Stripe exige
          toujours cet identifiant de prix.
        </p>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Forfait repassage 10 kg /mois"
          autoComplete="off"
        />
      </div>

      <div>
        <Label htmlFor="avantages">Avantages (une ligne par point)</Label>
        <textarea
          id="avantages"
          className={textareaClass}
          value={avantages}
          onChange={(e) => setAvantages(e.target.value)}
          placeholder={
            "Collecte 1 à 4 fois / mois — Retour en 24h\nCrédits cumulables…"
          }
        />
      </div>

      <div>
        <Label htmlFor="image">Image de couverture</Label>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            className="mb-3 max-h-52 w-full rounded-xl border border-slate-200 object-cover object-top"
          />
        ) : null}
        <input
          id="image"
          type="file"
          accept="image/*"
          className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-[#10294B] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-[#10294B]/90"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <p className="mt-1 text-xs text-slate-500">
          Formats image courants. Envoi vers Firebase Storage (
          <code className="rounded bg-slate-100 px-1">abonnements/…</code>
          ).
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <PrimaryButton type="submit" loading={pending} className="sm:flex-1">
          {mode === "create"
            ? "Créer l’abonnement"
            : "Appliquer les modifications"}
        </PrimaryButton>
        <Link
          href="/admin/abonnements"
          className="flex flex-1 items-center justify-center rounded-xl border-2 border-slate-200 bg-slate-50 py-3.5 text-center text-sm font-bold text-slate-700 transition hover:bg-slate-100"
        >
          Retour
        </Link>
      </div>
    </form>
  );
}
