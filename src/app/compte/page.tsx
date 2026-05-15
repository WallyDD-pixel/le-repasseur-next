"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { CompteAddressFields } from "@/components/compte/CompteAddressFields";
import { PageShell } from "@/components/shell/PageShell";
import { BackLink } from "@/components/ui/BackLink";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Input, Label, PrimaryButton } from "@/components/ui/FormField";
import { getFirebaseAuth, getFirebaseFirestore } from "@/lib/firebase";
import { getUserAccess } from "@/lib/authRedirect";
import {
  buildUserProfileUpdate,
  userProfileFromFirestore,
  validateUserProfileForm,
  type UserProfileForm,
} from "@/lib/userProfileFirestore";

function str(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return String(v);
}

const emptyProfile: UserProfileForm = {
  prenom: "",
  nom: "",
  telephone: "",
  societe: "",
  numero: "",
  voie: "",
  complementAdresse: "",
  codePostal: "",
  ville: "",
  adresseSecondaire: "non",
  numero2: "",
  voie2: "",
  complementAdresse2: "",
  codePostal2: "",
  ville2: "",
};

function ComptePageContent() {
  const searchParams = useSearchParams();
  const [user, setUser] = useState<{
    uid: string;
    email: string | null;
    role?: string;
    accountClosed: boolean;
  } | null>(null);
  const [form, setForm] = useState<UserProfileForm>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [access, setAccess] = useState<Awaited<
    ReturnType<typeof getUserAccess>
  > | null>(null);

  const wantsCloseAction = searchParams.get("action") === "close";

  const backHref =
    access?.isAdmin
      ? "/admin"
      : access?.isSubscribedClient || access?.isPendingSignup
        ? "/espace-client"
        : "/";

  const backLabel =
    access?.isAdmin
      ? "Retour à l’administration"
      : access?.isSubscribedClient || access?.isPendingSignup
        ? "Retour à l’espace client"
        : "Retour à l’accueil";

  useEffect(() => {
    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, async (u) => {
      setInfo(null);
      setError(null);
      if (!u) {
        setUser(null);
        setAccess(null);
        setLoading(false);
        return;
      }
      const db = getFirebaseFirestore();
      const snap = await getDoc(doc(db, "users", u.uid));
      const data = snap.exists()
        ? (snap.data() as Record<string, unknown>)
        : {};
      const role = str(data.role) || undefined;
      const closed =
        data.accountClosed === true ||
        data.compteFerme === true ||
        str(data.accountStatus).toLowerCase() === "closed";

      setUser({
        uid: u.uid,
        email: u.email,
        role,
        accountClosed: closed,
      });
      setForm(
        snap.exists() ? userProfileFromFirestore(data) : emptyProfile
      );

      const a = await getUserAccess(u.uid);
      setAccess(a);
      setLoading(false);
    });
  }, [searchParams]);

  function patchForm(patch: Partial<UserProfileForm>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    const validation = validateUserProfileForm(form);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    setSaving(true);
    setInfo(null);
    setError(null);
    try {
      const db = getFirebaseFirestore();
      await updateDoc(doc(db, "users", user.uid), {
        ...buildUserProfileUpdate(form),
        updatedAt: serverTimestamp(),
      });
      setInfo("Profil mis à jour.");
    } catch {
      setError("Enregistrement impossible. Réessayez.");
    } finally {
      setSaving(false);
    }
  }

  async function closeAccount() {
    if (!user) return;
    const ok = window.confirm(
      "Fermer votre compte ? Vous pourrez le réactiver plus tard en vous reconnectant."
    );
    if (!ok) return;
    setClosing(true);
    setInfo(null);
    setError(null);
    try {
      const db = getFirebaseFirestore();
      await updateDoc(doc(db, "users", user.uid), {
        accountClosed: true,
        accountStatus: "closed",
        closedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setUser((prev) => (prev ? { ...prev, accountClosed: true } : prev));
      setInfo("Votre compte est fermé.");
    } catch {
      setError("Fermeture du compte impossible.");
    } finally {
      setClosing(false);
    }
  }

  async function reactivateAccount() {
    if (!user) return;
    setReactivating(true);
    setInfo(null);
    setError(null);
    try {
      const db = getFirebaseFirestore();
      await updateDoc(doc(db, "users", user.uid), {
        accountClosed: false,
        accountStatus: "active",
        reactivatedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setUser((prev) => (prev ? { ...prev, accountClosed: false } : prev));
      setInfo("Votre compte est réactivé.");
    } catch {
      setError("Réactivation impossible.");
    } finally {
      setReactivating(false);
    }
  }

  if (loading) {
    return (
      <PageShell title="Mon espace" subtitle="Chargement de votre profil…">
        <p className="py-10 text-center text-slate-500">Patientez…</p>
      </PageShell>
    );
  }

  if (!user) {
    return (
      <PageShell
        title="Mon espace"
        subtitle="Connectez-vous pour accéder à votre tableau de bord."
      >
        <BackLink href="/" className="mb-6" />
        <p className="text-center text-slate-600">
          Vous n&apos;êtes pas connecté.
        </p>
        <ButtonLink href="/connexion" variant="primary" size="lg" fullWidth className="mt-8">
          Se connecter
        </ButtonLink>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Mon compte"
      subtitle="Modifiez vos informations personnelles et vos adresses."
      maxWidth="lg"
    >
      <div className="space-y-6">
        <BackLink href={backHref} label={backLabel} />

        {access?.isWaitingSector ? (
          <section className="rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-wider text-sky-800">
              Secteur en cours d&apos;ouverture
            </p>
            <p className="mt-1 text-sm leading-relaxed text-sky-900">
              Votre inscription est bien enregistrée. Le service n&apos;est pas encore
              disponible pour votre code postal
              {form.codePostal ? (
                <>
                  {" "}
                  (<strong>{form.codePostal}</strong>)
                </>
              ) : null}
              . Vous serez notifié dès que nous interviendrons dans votre ville.
            </p>
            <Link
              href="/communes"
              className="mt-3 inline-block text-sm font-semibold text-[#CE2029] hover:underline"
            >
              Voir les communes couvertes
            </Link>
          </section>
        ) : null}

        {info ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {info}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        {user.accountClosed ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
              Compte fermé
            </p>
            <p className="mt-1 text-sm text-amber-900">
              Votre compte est actuellement fermé. Vous pouvez le réactiver à tout moment.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void reactivateAccount()}
              loading={reactivating}
              className="mt-3 !border-amber-300 !text-amber-900 hover:!bg-amber-100"
            >
              Réactiver mon compte
            </Button>
          </section>
        ) : null}

        {wantsCloseAction && !user.accountClosed ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-wider text-red-700">
              Fermeture du compte
            </p>
            <p className="mt-1 text-sm text-red-900">
              Cette action ferme votre compte, mais vous pourrez le réactiver plus tard.
            </p>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => void closeAccount()}
              loading={closing}
              className="mt-3"
            >
              Fermer mon compte
            </Button>
          </section>
        ) : null}

        <form
          onSubmit={(e) => void saveProfile(e)}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white px-5 py-5"
        >
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#10294B]">
            Identité & contact
          </h3>

          <div>
            <Label htmlFor="compte-email">E-mail</Label>
            <Input
              id="compte-email"
              type="email"
              value={user.email ?? ""}
              readOnly
              className="bg-slate-50"
            />
            <p className="mt-1 text-xs text-slate-500">
              L’e-mail se modifie via Firebase Authentication.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="compte-prenom">Prénom</Label>
              <Input
                id="compte-prenom"
                value={form.prenom}
                onChange={(e) => patchForm({ prenom: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="compte-nom">Nom</Label>
              <Input
                id="compte-nom"
                value={form.nom}
                onChange={(e) => patchForm({ nom: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="compte-telephone">Téléphone</Label>
            <Input
              id="compte-telephone"
              type="tel"
              value={form.telephone}
              onChange={(e) => patchForm({ telephone: e.target.value })}
            />
          </div>

          <CompteAddressFields values={form} onChange={patchForm} />

          <PrimaryButton type="submit" loading={saving}>
            Enregistrer mes modifications
          </PrimaryButton>
        </form>

        {user.role ? (
          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[#CE2029]">
              Offre / rôle
            </p>
            <p className="mt-1 text-lg font-semibold text-[#10294B]">
              {user.role}
            </p>
          </div>
        ) : null}

        {access && !access.userExists ? (
          <p className="text-sm text-red-600">
            Profil introuvable dans la base. Contactez le support.
          </p>
        ) : null}
        {access?.unknownRoleError ? (
          <p className="text-sm text-amber-800">{access.unknownRoleError}</p>
        ) : null}

        {!user.accountClosed ? (
          <Button
            type="button"
            variant="danger"
            fullWidth
            onClick={() => void closeAccount()}
            loading={closing}
          >
            Fermer mon compte
          </Button>
        ) : null}

        <Button
          type="button"
          variant="secondary"
          fullWidth
          onClick={() => signOut(getFirebaseAuth())}
        >
          Se déconnecter
        </Button>
      </div>
    </PageShell>
  );
}

export default function ComptePage() {
  return (
    <Suspense
      fallback={
        <PageShell title="Mon espace" subtitle="Chargement de votre profil…">
          <p className="py-10 text-center text-slate-500">Patientez…</p>
        </PageShell>
      }
    >
      <ComptePageContent />
    </Suspense>
  );
}


