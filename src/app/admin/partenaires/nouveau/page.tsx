"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createPartnerPromo } from "@/lib/partnerPromoAdmin";
import { getFirebaseFirestore } from "@/lib/firebase";
import { firebaseMessage } from "@/lib/firebaseError";
import { Input, Label, PrimaryButton } from "@/components/ui/FormField";

export default function NouveauPartenairePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [poids, setPoids] = useState("");
  const [collectes, setCollectes] = useState("12");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
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
      await createPartnerPromo(getFirebaseFirestore(), {
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

  return (
    <div className="mx-auto max-w-lg">
      <Link
        href="/admin/partenaires"
        className="text-sm font-semibold text-[#10294B] hover:underline"
      >
        ← Codes partenaires
      </Link>
      <h1 className="mt-4 font-lobster text-3xl text-[#10294B]">
        Nouveau code partenaire
      </h1>
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
          <Label htmlFor="pc-code">Code</Label>
          <Input
            id="pc-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="mt-1 font-mono uppercase"
            placeholder="EX. ASCANNES"
          />
        </div>
        <div>
          <Label htmlFor="pc-kg">Poids (kg)</Label>
          <Input
            id="pc-kg"
            inputMode="decimal"
            value={poids}
            onChange={(e) => setPoids(e.target.value)}
            className="mt-1"
            placeholder="10"
          />
        </div>
        <div>
          <Label htmlFor="pc-col">Collectes incluses</Label>
          <Input
            id="pc-col"
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
