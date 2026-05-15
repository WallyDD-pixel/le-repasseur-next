"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseFirestore } from "@/lib/firebase";
import { getUserAccess } from "@/lib/authRedirect";
import { PageShell } from "@/components/shell/PageShell";
import { Input, Label, PrimaryButton } from "@/components/ui/FormField";

function str(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return String(v);
}

export default function ComptePage() {
  const searchParams = useSearchParams();
  const [user, setUser] = useState<{
    uid: string;
    email: string | null;
    role?: string;
    prenom: string;
    nom: string;
    telephone: string;
    codePostal: string;
    accountClosed: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [codePostal, setCodePostal] = useState("");
  const [access, setAccess] = useState<Awaited<
    ReturnType<typeof getUserAccess>
  > | null>(null);

  const wantsCloseAction = searchParams.get("action") === "close";

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
      const p = str(data.prenom);
      const n = str(data.nom);
      const tel = str(data.telephone || data.tel || data.phone);
      const cp = str(data.codePostal || data.cp);
      const closed =
        data.accountClosed === true ||
        data.compteFerme === true ||
        str(data.accountStatus).toLowerCase() === "closed";

      setUser({
        uid: u.uid,
        email: u.email,
        role,
        prenom: p,
        nom: n,
        telephone: tel,
        codePostal: cp,
        accountClosed: closed,
      });
      setPrenom(p);
      setNom(n);
      setTelephone(tel);
      setCodePostal(cp);

      const a = await getUserAccess(u.uid);
      setAccess(a);
      setLoading(false);
    });
  }, [searchParams]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setInfo(null);
    setError(null);
    try {
      const db = getFirebaseFirestore();
      await updateDoc(doc(db, "users", user.uid), {
        prenom: prenom.trim(),
        nom: nom.trim(),
        telephone: telephone.trim(),
        codePostal: codePostal.trim(),
        updatedAt: serverTimestamp(),
      });
      setUser((prev) =>
        prev
          ? {
              ...prev,
              prenom: prenom.trim(),
              nom: nom.trim(),
              telephone: telephone.trim(),
              codePostal: codePostal.trim(),
            }
          : prev
      );
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
        <p className="text-center text-slate-600">
          Vous n&apos;êtes pas connecté.
        </p>
        <Link
          href="/connexion"
          className="mt-8 block w-full rounded-xl bg-[#CE2029] py-3.5 text-center text-base font-bold text-white shadow-lg shadow-[#CE2029]/20 transition hover:bg-[#b91b24]"
        >
          Se connecter
        </Link>
      </PageShell>
    );
  }

  const primaryHref = access?.isAdmin
    ? "/admin"
    : access?.isSubscribedClient || access?.isPendingSignup
      ? "/espace-client"
      : null;

  const primaryLabel = access?.isAdmin
    ? "Administration"
    : access?.isSubscribedClient || access?.isPendingSignup
      ? "Mon espace client"
      : null;

  return (
    <PageShell
      title="Mon compte"
      subtitle="Modifiez vos informations et gérez l’état de votre compte."
      maxWidth="md"
    >
      <div className="space-y-6">
        {access?.isWaitingSector ? (
          <section className="rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-wider text-sky-800">
              Secteur en cours d&apos;ouverture
            </p>
            <p className="mt-1 text-sm leading-relaxed text-sky-900">
              Votre inscription est bien enregistrée. Le service n&apos;est pas encore
              disponible pour votre code postal
              {user.codePostal ? (
                <>
                  {" "}
                  (<strong>{user.codePostal}</strong>)
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

        {primaryHref && primaryLabel ? (
          <Link
            href={primaryHref}
            className="block w-full rounded-xl bg-[#CE2029] py-3.5 text-center text-base font-bold text-white shadow-lg shadow-[#CE2029]/20 transition hover:bg-[#b91b24]"
          >
            {primaryLabel}
          </Link>
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
            <button
              type="button"
              onClick={() => void reactivateAccount()}
              disabled={reactivating}
              className="mt-3 rounded-xl border-2 border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-100 disabled:opacity-60"
            >
              {reactivating ? "Réactivation…" : "Réactiver mon compte"}
            </button>
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
            <button
              type="button"
              onClick={() => void closeAccount()}
              disabled={closing}
              className="mt-3 rounded-xl bg-[#CE2029] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#b91b24] disabled:opacity-60"
            >
              {closing ? "Fermeture…" : "Fermer mon compte"}
            </button>
          </section>
        ) : null}

        <form
          onSubmit={(e) => void saveProfile(e)}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white px-5 py-5"
        >
          <div>
            <Label htmlFor="compte-email">E-mail</Label>
            <Input id="compte-email" type="email" value={user.email ?? ""} readOnly className="bg-slate-50" />
            <p className="mt-1 text-xs text-slate-500">
              L’e-mail se modifie via Firebase Authentication.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="compte-prenom">Prénom</Label>
              <Input
                id="compte-prenom"
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="compte-nom">Nom</Label>
              <Input
                id="compte-nom"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="compte-telephone">Téléphone</Label>
              <Input
                id="compte-telephone"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="compte-cp">Code postal</Label>
              <Input
                id="compte-cp"
                value={codePostal}
                onChange={(e) => setCodePostal(e.target.value)}
              />
            </div>
          </div>
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
          <button
            type="button"
            onClick={() => void closeAccount()}
            disabled={closing}
            className="w-full rounded-xl border-2 border-[#CE2029]/25 py-3 text-sm font-semibold text-[#CE2029] transition hover:bg-[#CE2029]/5 disabled:opacity-60"
          >
            {closing ? "Fermeture…" : "Fermer mon compte"}
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => signOut(getFirebaseAuth())}
          className="w-full rounded-xl border-2 border-[#10294B]/15 py-3 text-sm font-semibold text-[#10294B] transition hover:bg-[#10294B]/5"
        >
          Se déconnecter
        </button>
      </div>
    </PageShell>
  );
}
