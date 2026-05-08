"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ProduitForm } from "@/components/admin/ProduitForm";
import {
  PRODUITS_COLLECTION,
  docToProduitFormValues,
  resolveProduitByRouteId,
  type ProduitFormValues,
} from "@/lib/produitsAdmin";
import { getFirebaseFirestore } from "@/lib/firebase";

function routeSegmentToDocId(raw: string | string[] | undefined): string {
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (!s || typeof s !== "string") return "";
  try {
    return decodeURIComponent(s).trim();
  } catch {
    return s.trim();
  }
}

export default function ModifierProduitPage() {
  const params = useParams();
  const routeId = useMemo(
    () => routeSegmentToDocId(params?.id as string | string[] | undefined),
    [params]
  );

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [firestoreId, setFirestoreId] = useState<string>("");
  const [initial, setInitial] = useState<
    (ProduitFormValues & { imageUrl?: string }) | null
  >(null);

  useEffect(() => {
    if (!routeId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const db = getFirebaseFirestore();
    setLoading(true);
    setNotFound(false);

    resolveProduitByRouteId(db, routeId).then((res) => {
      if (!res) {
        setNotFound(true);
        setInitial(null);
        setFirestoreId("");
        setLoading(false);
        return;
      }
      setFirestoreId(res.id);
      setInitial(docToProduitFormValues(res.data));
      setLoading(false);
    });
  }, [routeId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center text-slate-500">
        Chargement…
      </div>
    );
  }

  if (notFound || !initial || !firestoreId) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 text-center">
        <p className="text-slate-600">Produit introuvable.</p>
        <p className="text-xs text-slate-500">
          ID demandé :{" "}
          <code className="rounded bg-slate-100 px-1">{routeId || "—"}</code>{" "}
          (collection{" "}
          <code className="rounded bg-slate-100 px-1">{PRODUITS_COLLECTION}</code>
          ).
        </p>
        <Link
          href="/admin/produits"
          className="font-semibold text-[#10294B] underline"
        >
          Retour à la liste
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-8">
        <p className="text-xs font-bold uppercase tracking-wider text-[#CE2029]">
          Modification
        </p>
        <h1 className="font-lobster text-3xl text-[#10294B] sm:text-4xl">
          Informations produit
        </h1>
        <p className="mt-2 text-slate-600">
          Mettre à jour la fiche Firestore — équivalent de l&apos;ancien écran
          produits.
        </p>
      </header>
      <ProduitForm
        mode="edit"
        documentId={firestoreId}
        initial={initial}
      />
    </div>
  );
}
