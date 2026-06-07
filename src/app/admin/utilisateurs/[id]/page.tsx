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
import {
  buildUserProfileUpdate,
  userAddressFromFirestore,
} from "@/lib/userProfileFirestore";
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
  const [societe, setSociete] = useState("");
  const [numero, setNumero] = useState("");
  const [voie, setVoie] = useState("");
  const [complementAdresse, setComplementAdresse] = useState("");
  const [codePostal, setCodePostal] = useState("");
  const [ville, setVille] = useState("");
  const [adresseSecondaire, setAdresseSecondaire] = useState(false);
  const [numero2, setNumero2] = useState("");
  const [voie2, setVoie2] = useState("");
  const [complementAdresse2, setComplementAdresse2] = useState("");
  const [codePostal2, setCodePostal2] = useState("");
  const [ville2, setVille2] = useState("");
  const [kg, setKg] = useState("");
  const [reservations, setReservations] = useState("");
  const [promoAbonnement, setPromoAbonnement] = useState("");
  const [promoProduit, setPromoProduit] = useState("");
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

      const addr = userAddressFromFirestore(data);
      setSociete(addr.societe);
      setNumero(addr.numero);
      setVoie(addr.voie);
      setComplementAdresse(addr.complementAdresse);
      setCodePostal(addr.codePostal);
      setVille(addr.ville);
      setAdresseSecondaire(addr.adresseSecondaire === "oui");
      setNumero2(addr.numero2);
      setVoie2(addr.voie2);
      setComplementAdresse2(addr.complementAdresse2);
      setCodePostal2(addr.codePostal2);
      setVille2(addr.ville2);

      // Métier Firestore : `collectes` = quota kg, `reservations` = collectes restantes
      const k = data.collectes ?? data.kg ?? data.poidsKg;
      setKg(typeof k === "number" ? String(k) : typeof k === "string" ? k : "");
      const r = data.reservations ?? data.nbReservations;
      setReservations(
        typeof r === "number"
          ? String(r)
          : typeof r === "string"
            ? r
            : "0"
      );
      const pa = data.promoAbonnementPourcent ?? data.promoAbonnementPercent;
      setPromoAbonnement(
        typeof pa === "number"
          ? String(pa)
          : typeof pa === "string"
            ? pa
            : ""
      );
      const pp = data.promoProduitPourcent ?? data.promoProduitPercent;
      setPromoProduit(
        typeof pp === "number"
          ? String(pp)
          : typeof pp === "string"
            ? pp
            : ""
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
      const promoA = promoAbonnement.trim() === ""
        ? 0
        : Number.parseFloat(promoAbonnement.replace(",", "."));
      const promoP = promoProduit.trim() === ""
        ? 0
        : Number.parseFloat(promoProduit.replace(",", "."));
      if (
        (promoAbonnement.trim() !== "" &&
          (Number.isNaN(promoA) || promoA < 0 || promoA > 100)) ||
        (promoProduit.trim() !== "" &&
          (Number.isNaN(promoP) || promoP < 0 || promoP > 100))
      ) {
        setError("Les pourcentages de promo doivent être entre 0 et 100.");
        setSaving(false);
        return;
      }

      const payload: Record<string, unknown> = {
        ...buildUserProfileUpdate({
          prenom,
          nom,
          telephone,
          societe,
          numero,
          voie,
          complementAdresse,
          codePostal,
          ville,
          adresseSecondaire: adresseSecondaire ? "oui" : "non",
          numero2,
          voie2,
          complementAdresse2,
          codePostal2,
          ville2,
        }),
        role: role.trim() || "aucun",
        ...(kgNum != null && !Number.isNaN(kgNum)
          ? { collectes: kgNum }
          : { collectes: 0 }),
        ...(Number.isFinite(resNum) && resNum >= 0
          ? { reservations: resNum }
          : { reservations: 0 }),
        promoAbonnementPourcent: Number.isFinite(promoA) ? promoA : 0,
        promoProduitPourcent: Number.isFinite(promoP) ? promoP : 0,
        ...(stampSignupDatesOnSave
          ? {
              createdAt: serverTimestamp(),
              dateInscription: serverTimestamp(),
            }
          : {}),
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, USERS_COLLECTION, userId), payload);
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
    <div className="mx-auto max-w-2xl">
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
        <div>
          <Label htmlFor="user-tel">Téléphone</Label>
          <Input
            id="user-tel"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            className="mt-1"
          />
        </div>

        <fieldset className="space-y-4 rounded-xl border border-slate-200/90 bg-slate-50/50 p-4">
          <legend className="px-1 text-sm font-bold text-[#10294B]">
            Adresse 1 (principale)
          </legend>
          <div>
            <Label htmlFor="user-societe">Société (optionnel)</Label>
            <Input
              id="user-societe"
              value={societe}
              onChange={(e) => setSociete(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="user-numero">N°</Label>
              <Input
                id="user-numero"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="user-voie">Voie</Label>
              <Input
                id="user-voie"
                value={voie}
                onChange={(e) => setVoie(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="user-complement">Complément d&apos;adresse</Label>
            <Input
              id="user-complement"
              value={complementAdresse}
              onChange={(e) => setComplementAdresse(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="user-cp">Code postal</Label>
              <Input
                id="user-cp"
                value={codePostal}
                onChange={(e) => setCodePostal(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="user-ville">Ville</Label>
              <Input
                id="user-ville"
                value={ville}
                onChange={(e) => setVille(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-4 rounded-xl border border-slate-200/90 bg-slate-50/50 p-4">
          <legend className="px-1 text-sm font-bold text-[#10294B]">
            Adresse 2 (secondaire)
          </legend>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[#10294B]">
            <input
              type="checkbox"
              checked={adresseSecondaire}
              onChange={(e) => setAdresseSecondaire(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#CE2029] focus:ring-[#CE2029]/40"
            />
            Adresse secondaire renseignée
          </label>
          {adresseSecondaire ? (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="user-numero2">N°</Label>
                  <Input
                    id="user-numero2"
                    value={numero2}
                    onChange={(e) => setNumero2(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="user-voie2">Voie</Label>
                  <Input
                    id="user-voie2"
                    value={voie2}
                    onChange={(e) => setVoie2(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="user-complement2">Complément d&apos;adresse</Label>
                <Input
                  id="user-complement2"
                  value={complementAdresse2}
                  onChange={(e) => setComplementAdresse2(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="user-cp2">Code postal</Label>
                  <Input
                    id="user-cp2"
                    value={codePostal2}
                    onChange={(e) => setCodePostal2(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="user-ville2">Ville</Label>
                  <Input
                    id="user-ville2"
                    value={ville2}
                    onChange={(e) => setVille2(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-500">Aucune adresse secondaire.</p>
          )}
        </fieldset>

        <section className="rounded-xl border border-[#10294B]/15 bg-[#10294B]/[0.03] px-4 py-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#10294B]">
            Promotions personnelles
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            Réduction en % sur le <strong>tarif catalogue actuel</strong> (Firestore).
            S&apos;applique au prochain paiement Stripe et à chaque renouvellement
            d&apos;abonnement. Utile pour conserver l&apos;ancien prix après une hausse :
            ex. ancien 39&nbsp;€, nouveau catalogue 49&nbsp;€ → promo ≈{" "}
            <strong>20,4</strong> (100 × (1 − 39/49)).
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="user-promo-abo">Promo abonnement (%)</Label>
              <Input
                id="user-promo-abo"
                inputMode="decimal"
                placeholder="0"
                value={promoAbonnement}
                onChange={(e) => setPromoAbonnement(e.target.value)}
                className="mt-1"
              />
              <p className="mt-1 text-xs text-slate-500">
                Renouvellements mensuels et nouvelle souscription.
              </p>
            </div>
            <div>
              <Label htmlFor="user-promo-prod">Promo produits (%)</Label>
              <Input
                id="user-promo-prod"
                inputMode="decimal"
                placeholder="0"
                value={promoProduit}
                onChange={(e) => setPromoProduit(e.target.value)}
                className="mt-1"
              />
              <p className="mt-1 text-xs text-slate-500">
                Packs et recharges (achat ponctuel).
              </p>
            </div>
          </div>
        </section>

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
