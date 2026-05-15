"use client";

import Link from "next/link";
import type { PostalCoverageStatus } from "@/lib/coveredPostalCodes";
import {
  MESSAGE_CP_COUVERT,
  MESSAGE_CP_HORS_SECTEUR,
} from "@/lib/coveredPostalCodes";
import { Input, Label } from "@/components/ui/FormField";

function PostalCodeCoverageHint({ status }: { status: PostalCoverageStatus }) {
  if (status === "incomplete") return null;
  if (status === "covered") {
    return (
      <p className="mt-1.5 text-xs font-medium text-emerald-700" role="status">
        {MESSAGE_CP_COUVERT}
      </p>
    );
  }
  return (
    <p className="mt-1.5 text-xs leading-relaxed text-amber-900" role="status">
      {MESSAGE_CP_HORS_SECTEUR}{" "}
      <Link href="/communes" className="font-semibold text-[#CE2029] hover:underline">
        Voir les codes postaux couverts
      </Link>
    </p>
  );
}

const selectClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-[#CE2029]/50 focus:ring-4 focus:ring-[#CE2029]/20";

function cpInputClass(status: PostalCoverageStatus): string {
  if (status === "not_covered")
    return "border-amber-400 focus:border-amber-500 focus:ring-amber-200";
  if (status === "covered")
    return "border-emerald-400 focus:border-emerald-500 focus:ring-emerald-200";
  return "";
}

export type InscriptionFormValues = {
  nom: string;
  prenom: string;
  numero: string;
  societe: string;
  voie: string;
  email: string;
  complementAdresse: string;
  password: string;
  passwordConfirm: string;
  codePostal: string;
  ville: string;
  adresseSecondaire: "non" | "oui";
  numero2: string;
  voie2: string;
  complementAdresse2: string;
  codePostal2: string;
  ville2: string;
  telephone: string;
  acceptCgu: boolean;
};

type Setters = {
  [K in keyof InscriptionFormValues]: (
    value: InscriptionFormValues[K]
  ) => void;
};

type Props = {
  values: InscriptionFormValues;
  set: Setters;
  mainCpStatus: PostalCoverageStatus;
  secondaryCpStatus: PostalCoverageStatus;
  horsSecteur: boolean;
  error: string | null;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
};

export function InscriptionFormFields({
  values: v,
  set,
  mainCpStatus,
  secondaryCpStatus,
  horsSecteur,
  error,
  loading,
  onSubmit,
}: Props) {
  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <section className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="nom">Nom</Label>
            <Input
              id="nom"
              required
              value={v.nom}
              onChange={(e) => set.nom(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="prenom">Prénom</Label>
            <Input
              id="prenom"
              required
              value={v.prenom}
              onChange={(e) => set.prenom(e.target.value)}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            value={v.email}
            onChange={(e) => set.email(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={v.password}
              onChange={(e) => set.password(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="passwordConfirm">Confirmez le mot de passe</Label>
            <Input
              id="passwordConfirm"
              type="password"
              required
              minLength={6}
              value={v.passwordConfirm}
              onChange={(e) => set.passwordConfirm(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section>
        <div className="max-w-md">
          <Label htmlFor="telephone">Téléphone</Label>
          <Input
            id="telephone"
            type="tel"
            required
            value={v.telephone}
            onChange={(e) => set.telephone(e.target.value)}
          />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <Label htmlFor="societe">Société</Label>
          <Input
            id="societe"
            value={v.societe}
            onChange={(e) => set.societe(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          <div className="md:col-span-3">
            <Label htmlFor="numero">N°</Label>
            <Input
              id="numero"
              required
              value={v.numero}
              onChange={(e) => set.numero(e.target.value)}
            />
          </div>
          <div className="md:col-span-9">
            <Label htmlFor="voie">Voie</Label>
            <Input
              id="voie"
              required
              value={v.voie}
              onChange={(e) => set.voie(e.target.value)}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="complement">Complément d&apos;adresse</Label>
          <Input
            id="complement"
            placeholder="Bat, Appartement, Résidence"
            value={v.complementAdresse}
            onChange={(e) => set.complementAdresse(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          <div className="md:col-span-4">
            <Label htmlFor="codePostal">Code postal</Label>
            <Input
              id="codePostal"
              required
              inputMode="numeric"
              maxLength={5}
              value={v.codePostal}
              aria-describedby={
                mainCpStatus !== "incomplete" ? "codePostal-hint" : undefined
              }
              className={cpInputClass(mainCpStatus)}
              onChange={(e) =>
                set.codePostal(e.target.value.replace(/\D/g, "").slice(0, 5))
              }
            />
          </div>
          <div className="md:col-span-8">
            <Label htmlFor="ville">Ville</Label>
            <Input
              id="ville"
              required
              value={v.ville}
              onChange={(e) => set.ville(e.target.value)}
            />
          </div>
        </div>
        {mainCpStatus !== "incomplete" ? (
          <div id="codePostal-hint" className="md:pl-[33.333%]">
            <PostalCodeCoverageHint status={mainCpStatus} />
          </div>
        ) : null}

        <div>
          <Label htmlFor="adresseSecondaire">
            Souhaitez-vous renseigner une adresse secondaire ?
          </Label>
          <select
            id="adresseSecondaire"
            value={v.adresseSecondaire}
            onChange={(e) =>
              set.adresseSecondaire(e.target.value as "non" | "oui")
            }
            className={selectClass}
          >
            <option value="non">Non</option>
            <option value="oui">Oui</option>
          </select>
        </div>

        {v.adresseSecondaire === "oui" ? (
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-6">
            <p className="text-sm font-semibold text-[#10294B]">Adresse secondaire</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
              <div className="md:col-span-3">
                <Label htmlFor="numero2">N°</Label>
                <Input
                  id="numero2"
                  required
                  value={v.numero2}
                  onChange={(e) => set.numero2(e.target.value)}
                />
              </div>
              <div className="md:col-span-9">
                <Label htmlFor="voie2">Voie</Label>
                <Input
                  id="voie2"
                  required
                  value={v.voie2}
                  onChange={(e) => set.voie2(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="complement2">Complément d&apos;adresse</Label>
              <Input
                id="complement2"
                placeholder="Bat, Appartement, Résidence"
                value={v.complementAdresse2}
                onChange={(e) => set.complementAdresse2(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
              <div className="sm:col-span-4">
                <Label htmlFor="codePostal2">Code postal</Label>
                <Input
                  id="codePostal2"
                  required
                  inputMode="numeric"
                  maxLength={5}
                  value={v.codePostal2}
                  aria-describedby={
                    secondaryCpStatus !== "incomplete"
                      ? "codePostal2-hint"
                      : undefined
                  }
                  className={cpInputClass(secondaryCpStatus)}
                  onChange={(e) =>
                    set.codePostal2(e.target.value.replace(/\D/g, "").slice(0, 5))
                  }
                />
              </div>
              <div className="sm:col-span-8">
                <Label htmlFor="ville2">Ville</Label>
                <Input
                  id="ville2"
                  required
                  value={v.ville2}
                  onChange={(e) => set.ville2(e.target.value)}
                />
              </div>
            </div>
            {secondaryCpStatus !== "incomplete" ? (
              <div id="codePostal2-hint" className="sm:max-w-md">
                <PostalCodeCoverageHint status={secondaryCpStatus} />
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {horsSecteur ? (
        <div
          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          <p className="font-semibold">Service pas encore disponible dans votre ville</p>
          <p className="mt-1 leading-relaxed">
            Votre code postal principal n&apos;est pas encore desservi. Vous pouvez valider
            l&apos;inscription : à la fin, une page vous confirmera que nous vous
            préviendrons dès l&apos;ouverture du secteur.
          </p>
        </div>
      ) : null}

      <label className="flex items-start gap-3 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={v.acceptCgu}
          onChange={(e) => set.acceptCgu(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-slate-300 text-[#CE2029] focus:ring-[#CE2029]"
        />
        <span>
          En créant un compte, vous acceptez les{" "}
          <Link href="/cgu" className="font-semibold text-[#CE2029] hover:underline">
            conditions générales d&apos;utilisation
          </Link>
          .
        </span>
      </label>

      {error ? (
        <p className="text-center text-sm font-semibold text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="space-y-2 text-center text-sm text-slate-600">
        <p>
          Déjà inscrit ?{" "}
          <Link href="/connexion" className="font-semibold text-[#10294B] hover:underline">
            Connectez-vous ici
          </Link>
        </p>
        <p>
          <Link href="/communes" className="font-semibold text-[#10294B] hover:underline">
            Liste des communes couvertes ici
          </Link>
        </p>
      </div>

      <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
        <button
          type="submit"
          disabled={loading}
          className="min-w-[200px] rounded-xl bg-[#10294B] px-8 py-3 font-semibold text-white transition hover:bg-[#0c203d] disabled:opacity-60"
        >
          {loading ? "Patientez…" : "Créer un compte"}
        </button>
        <Link
          href="/"
          className="min-w-[200px] rounded-xl bg-[#CE2029] px-8 py-3 text-center font-semibold text-white transition hover:bg-[#b91b24]"
        >
          Retour
        </Link>
      </div>
    </form>
  );
}
