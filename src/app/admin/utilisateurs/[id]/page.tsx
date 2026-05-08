"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { Input, Label, PrimaryButton } from "@/components/ui/FormField";
import {
  ABONNEMENTS_COLLECTION,
  isHiddenSystemAbonnement,
} from "@/lib/abonnementsAdmin";
import {
  USERS_COLLECTION,
  userDocLacksSignupTimestamps,
} from "@/lib/usersAdmin";
import { getFirebaseFirestore } from "@/lib/firebase";
import { firebaseMessage } from "@/lib/firebaseError";

export default function ModifierUtilisateurPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = params.id;
  const userId =
    typeof rawId === "string" ? rawId : Array.isArray(rawId) ? rawId[0] : "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [role, setRole] = useState("aucun");
  const [telephone, setTelephone] = useState("");
  const [codePostal, setCodePostal] = useState("");
  const [kg, setKg] = useState("");
  const [reservations, setReservations] = useState("");
  const [roleOptions, setRoleOptions] = useState<string[]>([
    "aucun",
    "admin",
  ]);
  /** À la première sauvegarde : pose createdAt + dateInscription si le doc n’en avait pas. */
  const [stampSignupDatesOnSave, setStampSignupDatesOnSave] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const db = getFirebaseFirestore();
      const [userSnap, aboSnap] = await Promise.all([
        getDoc(doc(db, USERS_COLLECTION, userId)),
        getDocs(collection(db, ABONNEMENTS_COLLECTION)),
      ]);

      const formulas: string[] = [];
      aboSnap.forEach((d) => {
        const raw = d.data() as Record<string, unknown>;
        if (isHiddenSystemAbonnement(raw)) return;
        const n = raw.nom;
        if (typeof n === "string" && n.trim()) formulas.push(n.trim());
      });

      if (!userSnap.exists()) {
        setError("Utilisateur introuvable.");
        return;
      }
      const data = userSnap.data() as Record<string, unknown>;
      const currentRole =
        typeof data.role === "string" ? data.role.trim() : "aucun";
      const mergedRoles = [
        ...new Set(["aucun", "admin", ...formulas, currentRole]),
      ].sort((a, b) => a.localeCompare(b, "fr"));
      setRoleOptions(mergedRoles);

      setEmail(typeof data.email === "string" ? data.email : "");
      setPrenom(typeof data.prenom === "string" ? data.prenom : "");
      setNom(typeof data.nom === "string" ? data.nom : "");
      setRole(typeof data.role === "string" ? data.role : "aucun");
      setTelephone(
        typeof data.telephone === "string"
          ? data.telephone
          : typeof data.tel === "string"
            ? data.tel
            : ""
      );
      setCodePostal(
        typeof data.codePostal === "string"
          ? data.codePostal
          : typeof data.cp === "string"
            ? data.cp
            : ""
      );
      const k = data.kg ?? data.poidsKg;
      setKg(typeof k === "number" ? String(k) : typeof k === "string" ? k : "");
      const r = data.reservations ?? data.nbReservations;
      setReservations(
        typeof r === "number"
          ? String(r)
          : typeof r === "string"
            ? r
            : "0"
      );
      setStampSignupDatesOnSave(userDocLacksSignupTimestamps(data));
    } catch (err) {
      setError(`Impossible de charger le profil — ${firebaseMessage(err)}`);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setSaving(true);
    setError(null);
    try {
      const db = getFirebaseFirestore();
      const kgNum = kg.trim() === "" ? null : Number.parseFloat(kg.replace(",", "."));
      const resNum = Number.parseInt(reservations, 10);
      await updateDoc(doc(db, USERS_COLLECTION, userId), {
        prenom: prenom.trim(),
        nom: nom.trim(),
        role: role.trim() || "aucun",
        telephone: telephone.trim(),
        codePostal: codePostal.trim(),
        ...(kgNum != null && !Number.isNaN(kgNum) ? { kg: kgNum } : { kg: 0 }),
        ...(Number.isFinite(resNum) && resNum >= 0
          ? { reservations: resNum }
          : { reservations: 0 }),
        ...(stampSignupDatesOnSave
          ? {
              createdAt: serverTimestamp(),
              dateInscription: serverTimestamp(),
            }
          : {}),
        updatedAt: serverTimestamp(),
      });
      router.push("/admin/utilisateurs");
    } catch (err) {
      setError(`Enregistrement impossible — ${firebaseMessage(err)}`);
    } finally {
      setSaving(false);
    }
  }

  if (!userId) {
    return (
      <p className="text-red-700">Identifiant invalide dans l&apos;URL.</p>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-slate-600">
        Chargement…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-8">
        <Link
          href="/admin/utilisateurs"
          className="text-sm font-semibold text-[#10294B] hover:underline"
        >
          ← Liste des utilisateurs
        </Link>
        <h1 className="mt-4 font-lobster text-3xl text-[#10294B]">
          Modifier le profil
        </h1>
        <p className="mt-2 font-mono text-xs text-slate-500">UID : {userId}</p>
      </div>

      {error ? (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {stampSignupDatesOnSave ? (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Ce profil n&apos;a ni « dateInscription » ni « createdAt ». Au premier
          enregistrement, la date d&apos;inscription et la date de création seront
          fixées à <strong>maintenant</strong> (équivalent fiche créée à la main).
        </p>
      ) : null}

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="space-y-5 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm"
      >
        <div>
          <Label htmlFor="user-email">Email</Label>
          <Input
            id="user-email"
            type="email"
            value={email}
            readOnly
            className="mt-1 bg-slate-50"
          />
          <p className="mt-1 text-xs text-slate-500">
            Modifiable depuis Firebase Authentication.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="user-prenom">Prénom</Label>
            <Input
              id="user-prenom"
              value={prenom}
              onChange={(e) => setPrenom(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="user-nom">Nom</Label>
            <Input
              id="user-nom"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="user-role">Rôle / formule</Label>
          <select
            id="user-role"
            value={roleOptions.includes(role) ? role : "aucun"}
            onChange={(e) => setRole(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-[#10294B] outline-none focus:border-[#CE2029]/50 focus:ring-4 focus:ring-[#CE2029]/15"
          >
            {roleOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="user-tel">Téléphone</Label>
            <Input
              id="user-tel"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="user-cp">Code postal</Label>
            <Input
              id="user-cp"
              value={codePostal}
              onChange={(e) => setCodePostal(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="user-kg">Kg</Label>
            <Input
              id="user-kg"
              inputMode="decimal"
              value={kg}
              onChange={(e) => setKg(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="user-res">Réservations</Label>
            <Input
              id="user-res"
              inputMode="numeric"
              value={reservations}
              onChange={(e) => setReservations(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
          <Link
            href="/admin/utilisateurs"
            className="rounded-xl border border-slate-200 py-3 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:px-6"
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
