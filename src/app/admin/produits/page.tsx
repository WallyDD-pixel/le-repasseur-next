"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  type DocumentData,
} from "firebase/firestore";
import { ProduitCard } from "@/components/admin/ProduitCard";
import { PRODUITS_COLLECTION } from "@/lib/produitsAdmin";
import { getFirebaseFirestore } from "@/lib/firebase";

export default function AdminProduitsListPage() {
  const [items, setItems] = useState<{ id: string; data: DocumentData }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const db = getFirebaseFirestore();
      const col = collection(db, PRODUITS_COLLECTION);
      let snap;
      try {
        snap = await getDocs(query(col, orderBy("nom")));
      } catch {
        snap = await getDocs(col);
      }
      const rows: { id: string; data: DocumentData }[] = [];
      snap.forEach((d) => {
        rows.push({ id: d.id, data: d.data() });
      });
      rows.sort((a, b) => {
        const na = typeof a.data.nom === "string" ? a.data.nom : "";
        const nb = typeof b.data.nom === "string" ? b.data.nom : "";
        return na.localeCompare(nb, "fr");
      });
      setItems(rows);
    } catch {
      setError("Impossible de charger les produits.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(id: string) {
    try {
      await deleteDoc(doc(getFirebaseFirestore(), PRODUITS_COLLECTION, id));
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch {
      setError("Suppression impossible.");
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-lobster text-3xl text-[#10294B] sm:text-4xl">
            Nos produits
          </h1>
          <p className="mt-2 max-w-xl text-slate-600">
            Fiches stockées dans Firestore — collection{" "}
            <code className="rounded bg-slate-100 px-1 text-xs">produits</code>.
          </p>
        </div>
        <Link
          href="/admin/produits/nouveau"
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[#CE2029] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-[#CE2029]/25 transition hover:bg-[#b91b24]"
        >
          Ajouter un produit
        </Link>
      </div>

      {error ? (
        <p className="mb-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="py-16 text-center text-slate-500">Chargement…</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-16 text-center">
          <p className="text-slate-600">Aucun produit dans Firestore.</p>
          <Link
            href="/admin/produits/nouveau"
            className="mt-4 inline-block font-semibold text-[#10294B] underline"
          >
            Créer le premier produit
          </Link>
        </div>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {items.map(({ id, data }) => (
            <li key={id}>
              <ProduitCard id={id} data={data} onDelete={handleDelete} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
