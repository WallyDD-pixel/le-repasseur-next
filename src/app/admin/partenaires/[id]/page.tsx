"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import {
  PROMO_COLLECTION,
  normalizePromoDoc,
  updatePartnerPromo,
  type PartnerPromoRow,
} from "@/lib/partnerPromoAdmin";
import { getFirebaseFirestore } from "@/lib/firebase";
import { firebaseMessage } from "@/lib/firebaseError";
import { Input, Label, PrimaryButton } from "@/components/ui/FormField";

export default function ModifierPartenairePage() {
  const params = useParams();
  const router = useRouter();
  const raw = params.id;
  const id =
    typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] ?? "" : "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [poids, setPoids] = useState("");
  const [collectes, setCollectes] = useState("");
  const [saving, setSaving] = useState(false);
  const [initial, setInitial] = useState<PartnerPromoRow | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const s = await getDoc(doc(getFirebaseFirestore(), PROMO_COLLECTION, id));
      if (!s.exists()) {
        setError("Code introuvable.");
        setInitial(null);
        return;
      }
      const row = normalizePromoDoc(id, s.data() as Record<string, unknown>);
      setInitial(row);
      setCode(row.code === "—" ? "" : row.code);
      setPoids(row.poidsKg != null ? String(row.poidsKg) : "");
      setCollectes(String(row.collectes));
    } catch (err) {
      setError(firebaseMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setError(null);
    const p = Number.parseFloat(poids.replace(",", "."));
    const c = Number.parseInt(collectes, 10);
    if (!code.trim()) {
      setError("Indiquez un code.");
      return;
    }
    if (Number.isNaN(p) || p <= 0) {
      setError("Poids (kg) invalide.");
      return;
    }
    if (!Number.isFinite(c) || c < 0) {
      setError("Nombre de collectes invalide.");
      return;
    }
    setSaving(true);
    try {
      await updatePartnerPromo(getFirebaseFirestore(), id, {
        code: code.trim(),
        poidsKg: p,
        collectes: c,
      });
      router.push("/admin/partenaires");
    } catch (err) {
      setError(firebaseMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!id) {
    return <p className="text-red-700">Identifiant invalide.</p>;
  }
  if (loading) {
    return <p className="py-16 text-center text-slate-600">Chargement…</p>;
  }
  if (error && !initial) {
    return (
      <div className="mx-auto max-w-lg">
        <p className="text-red-700">{error}</p>
        <Link href="/admin/partenaires" className="mt-4 inline-block text-[#10294B]">
          ← Retour
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <Link
        href="/admin/partenaires"
        className="text-sm font-semibold text-[#10294B] hover:underline"
      >
        ← Codes partenaires
      </Link>
      <h1 className="mt-4 font-lobster text-3xl text-[#10294B]">
        Modifier le code
      </h1>
      <p className="mt-1 font-mono text-xs text-slate-500">{id}</p>
      {error ? (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      <form
        onSubmit={(e) => void onSubmit(e)}
        className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <Label htmlFor="e-code">Code</Label>
          <Input
            id="e-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="mt-1 font-mono uppercase"
          />
        </div>
        <div>
          <Label htmlFor="e-kg">Poids (kg)</Label>
          <Input
            id="e-kg"
            inputMode="decimal"
            value={poids}
            onChange={(e) => setPoids(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="e-col">Collectes incluses</Label>
          <Input
            id="e-col"
            inputMode="numeric"
            value={collectes}
            onChange={(e) => setCollectes(e.target.value)}
            className="mt-1"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Link
            href="/admin/partenaires"
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Annuler
          </Link>
          <PrimaryButton type="submit" loading={saving}>
            Enregistrer
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}
