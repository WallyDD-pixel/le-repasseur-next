"use client";

import { useState } from "react";
import Link from "next/link";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseFirestore } from "@/lib/firebase";
import {
  cityForPostalCode,
  isPostalCodeCovered,
  normalizePostalCode,
  postalCodeCoverageStatus,
} from "@/lib/coveredPostalCodes";
import { CommunesCouvertesLink } from "@/components/inscription/CommunesCouvertesLink";
import {
  InscriptionFormFields,
  type InscriptionFormValues,
} from "@/components/inscription/InscriptionFormFields";
import { PageShell } from "@/components/shell/PageShell";

type SuccessState = { kind: "out_of_zone"; ville: string; codePostal: string };

export default function InscriptionPage() {
  const [values, setValues] = useState<InscriptionFormValues>({
    nom: "",
    prenom: "",
    numero: "",
    societe: "",
    voie: "",
    email: "",
    complementAdresse: "",
    password: "",
    passwordConfirm: "",
    codePostal: "",
    ville: "",
    adresseSecondaire: "non",
    numero2: "",
    voie2: "",
    complementAdresse2: "",
    codePostal2: "",
    ville2: "",
    telephone: "",
    acceptCgu: false,
  });

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<SuccessState | null>(null);

  const mainCpStatus = postalCodeCoverageStatus(values.codePostal);
  const secondaryCpStatus = postalCodeCoverageStatus(values.codePostal2);
  const horsSecteur = mainCpStatus === "not_covered";

  const set = {
    nom: (v: string) => setValues((s) => ({ ...s, nom: v })),
    prenom: (v: string) => setValues((s) => ({ ...s, prenom: v })),
    numero: (v: string) => setValues((s) => ({ ...s, numero: v })),
    societe: (v: string) => setValues((s) => ({ ...s, societe: v })),
    voie: (v: string) => setValues((s) => ({ ...s, voie: v })),
    email: (v: string) => setValues((s) => ({ ...s, email: v })),
    complementAdresse: (v: string) => setValues((s) => ({ ...s, complementAdresse: v })),
    password: (v: string) => setValues((s) => ({ ...s, password: v })),
    passwordConfirm: (v: string) => setValues((s) => ({ ...s, passwordConfirm: v })),
    codePostal: (v: string) =>
      setValues((s) => {
        const city = cityForPostalCode(v);
        return {
          ...s,
          codePostal: v,
          ...(city && !s.ville.trim() ? { ville: city } : {}),
        };
      }),
    ville: (v: string) => setValues((s) => ({ ...s, ville: v })),
    adresseSecondaire: (v: "non" | "oui") =>
      setValues((s) => ({ ...s, adresseSecondaire: v })),
    numero2: (v: string) => setValues((s) => ({ ...s, numero2: v })),
    voie2: (v: string) => setValues((s) => ({ ...s, voie2: v })),
    complementAdresse2: (v: string) =>
      setValues((s) => ({ ...s, complementAdresse2: v })),
    codePostal2: (v: string) => setValues((s) => ({ ...s, codePostal2: v })),
    ville2: (v: string) => setValues((s) => ({ ...s, ville2: v })),
    telephone: (v: string) => setValues((s) => ({ ...s, telephone: v })),
    acceptCgu: (v: boolean) => setValues((s) => ({ ...s, acceptCgu: v })),
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (values.password !== values.passwordConfirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    if (values.password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (!values.acceptCgu) {
      setError("Vous devez accepter les conditions générales d’utilisation.");
      return;
    }

    const cp = normalizePostalCode(values.codePostal);
    if (!/^\d{5}$/.test(cp)) {
      setError("Code postal invalide (5 chiffres).");
      return;
    }

    const wantsSecondary = values.adresseSecondaire === "oui";
    let cp2 = "";
    if (wantsSecondary) {
      if (!values.numero2.trim() || !values.voie2.trim() || !values.ville2.trim()) {
        setError("Renseignez l’adresse secondaire (N°, voie et ville).");
        return;
      }
      cp2 = normalizePostalCode(values.codePostal2);
      if (!/^\d{5}$/.test(cp2)) {
        setError("Code postal de l’adresse secondaire invalide (5 chiffres).");
        return;
      }
    }

    const covered = isPostalCodeCovered(cp);
    setLoading(true);

    try {
      const auth = getFirebaseAuth();
      const db = getFirebaseFirestore();
      const cred = await createUserWithEmailAndPassword(
        auth,
        values.email.trim(),
        values.password
      );

      const now = serverTimestamp();
      await setDoc(doc(db, "users", cred.user.uid), {
        email: values.email.trim(),
        nom: values.nom.trim(),
        prenom: values.prenom.trim(),
        numero: values.numero.trim(),
        societe: values.societe.trim(),
        voie: values.voie.trim(),
        complementAdresse: values.complementAdresse.trim(),
        codePostal: cp,
        ville: values.ville.trim(),
        telephone: values.telephone.trim(),
        adresseSecondaire: wantsSecondary,
        ...(wantsSecondary
          ? {
              adresseSecondaireDetails: {
                numero: values.numero2.trim(),
                voie: values.voie2.trim(),
                complementAdresse: values.complementAdresse2.trim(),
                codePostal: cp2,
                ville: values.ville2.trim(),
              },
            }
          : {}),
        secteurCouvert: covered,
        role: covered ? "aucun" : "attente_secteur",
        reservations: 0,
        collectes: 0,
        accountStatus: "active",
        accountClosed: false,
        acceptCgu: true,
        cguAcceptedAt: now,
        inscriptionSource: "web",
        createdAt: now,
        dateInscription: now,
        inscriptionDate: now,
        updatedAt: now,
      });

      if (covered) {
        window.location.href = "/espace-client?welcome=1";
        return;
      }

      setSuccess({
        kind: "out_of_zone",
        ville: values.ville.trim(),
        codePostal: cp,
      });
    } catch (err: unknown) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code: string }).code)
          : "";
      if (code === "auth/email-already-in-use") {
        setError("Cet e-mail est déjà utilisé.");
      } else if (code === "auth/weak-password") {
        setError("Mot de passe trop faible (min. 6 caractères).");
      } else {
        setError("Inscription impossible. Réessayez.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (success?.kind === "out_of_zone") {
    return (
      <PageShell
        title="Inscription enregistrée"
        subtitle="Merci pour votre confiance."
        maxWidth="lg"
      >
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-slate-800">
          <p className="text-lg font-semibold text-emerald-900">
            Votre inscription a bien été prise en compte.
          </p>
          <p className="mt-3 leading-relaxed">
            Le service n’est pas encore disponible pour le code postal{" "}
            <strong>{success.codePostal}</strong>
            {success.ville ? (
              <>
                {" "}
                (<strong>{success.ville}</strong>)
              </>
            ) : null}
            . Le service n&apos;est pas encore disponible dans votre ville : nous
            vous enverrons une notification dès l&apos;ouverture de votre secteur.
          </p>
          <p className="mt-4 text-sm text-slate-600">
            En attendant, vous pouvez consulter la{" "}
            <CommunesCouvertesLink>
              liste des communes couvertes
            </CommunesCouvertesLink>
            .
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/connexion"
              className="rounded-xl bg-[#10294B] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#0c203d]"
            >
              Se connecter
            </Link>
            <Link
              href="/"
              className="rounded-xl border-2 border-[#CE2029] px-6 py-2.5 text-sm font-semibold text-[#CE2029] hover:bg-[#CE2029]/5"
            >
              Retour à l’accueil
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="Créer un compte" showShellHeading={false} maxWidth="xl">
      <h1 className="mb-4 text-center text-3xl font-bold text-[#10294B] md:text-4xl">
        Créer un compte
      </h1>

      <p className="mb-8 text-center text-sm text-slate-600">
        <CommunesCouvertesLink className="inline-flex items-center gap-1.5 font-semibold text-[#10294B] hover:text-[#CE2029]">
          Voir la liste des communes couvertes
          <span aria-hidden>→</span>
        </CommunesCouvertesLink>
      </p>

      <InscriptionFormFields
        values={values}
        set={set}
        mainCpStatus={mainCpStatus}
        secondaryCpStatus={secondaryCpStatus}
        horsSecteur={horsSecteur}
        error={error}
        loading={loading}
        onSubmit={onSubmit}
      />
    </PageShell>
  );
}
