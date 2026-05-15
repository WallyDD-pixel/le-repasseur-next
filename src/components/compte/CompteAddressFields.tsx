"use client";

import {
  MESSAGE_CP_COUVERT,
  MESSAGE_CP_HORS_SECTEUR,
  postalCodeCoverageStatus,
  type PostalCoverageStatus,
} from "@/lib/coveredPostalCodes";
import type { UserAddressForm } from "@/lib/userProfileFirestore";
import { CommunesCouvertesLink } from "@/components/inscription/CommunesCouvertesLink";
import { Input, Label } from "@/components/ui/FormField";

const selectClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-[#CE2029]/50 focus:ring-4 focus:ring-[#CE2029]/20";

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
      <CommunesCouvertesLink>Voir les codes postaux couverts</CommunesCouvertesLink>
    </p>
  );
}

function cpInputClass(status: PostalCoverageStatus): string {
  if (status === "not_covered")
    return "border-amber-400 focus:border-amber-500 focus:ring-amber-200";
  if (status === "covered")
    return "border-emerald-400 focus:border-emerald-500 focus:ring-emerald-200";
  return "";
}

type Props = {
  values: UserAddressForm;
  onChange: (patch: Partial<UserAddressForm>) => void;
};

export function CompteAddressFields({ values: v, onChange }: Props) {
  const mainCpStatus = postalCodeCoverageStatus(v.codePostal);
  const secondaryCpStatus = postalCodeCoverageStatus(v.codePostal2);

  return (
    <div className="space-y-5 border-t border-slate-100 pt-5">
      <h3 className="text-sm font-bold uppercase tracking-wider text-[#10294B]">
        Adresse principale
      </h3>

      <div>
        <Label htmlFor="compte-societe">Société (optionnel)</Label>
        <Input
          id="compte-societe"
          value={v.societe}
          onChange={(e) => onChange({ societe: e.target.value })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-12">
        <div className="sm:col-span-3">
          <Label htmlFor="compte-numero">N°</Label>
          <Input
            id="compte-numero"
            value={v.numero}
            onChange={(e) => onChange({ numero: e.target.value })}
          />
        </div>
        <div className="sm:col-span-9">
          <Label htmlFor="compte-voie">Voie</Label>
          <Input
            id="compte-voie"
            value={v.voie}
            onChange={(e) => onChange({ voie: e.target.value })}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="compte-complement">Complément d&apos;adresse</Label>
        <Input
          id="compte-complement"
          placeholder="Bât., appartement, résidence…"
          value={v.complementAdresse}
          onChange={(e) => onChange({ complementAdresse: e.target.value })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="compte-cp-addr">Code postal</Label>
          <Input
            id="compte-cp-addr"
            inputMode="numeric"
            maxLength={5}
            className={cpInputClass(mainCpStatus)}
            value={v.codePostal}
            onChange={(e) =>
              onChange({
                codePostal: e.target.value.replace(/\D/g, "").slice(0, 5),
              })
            }
          />
          <PostalCodeCoverageHint status={mainCpStatus} />
        </div>
        <div>
          <Label htmlFor="compte-ville">Ville</Label>
          <Input
            id="compte-ville"
            value={v.ville}
            onChange={(e) => onChange({ ville: e.target.value })}
          />
        </div>
      </div>

      <div className="border-t border-slate-100 pt-5">
        <Label htmlFor="compte-adresse-sec">
          Adresse secondaire (optionnelle)
        </Label>
        <select
          id="compte-adresse-sec"
          className={`${selectClass} mt-1`}
          value={v.adresseSecondaire}
          onChange={(e) =>
            onChange({
              adresseSecondaire: e.target.value as "non" | "oui",
            })
          }
        >
          <option value="non">Non</option>
          <option value="oui">Oui, ajouter une adresse secondaire</option>
        </select>
      </div>

      {v.adresseSecondaire === "oui" ? (
        <div className="space-y-4 rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
          <p className="text-sm font-semibold text-[#10294B]">Adresse secondaire</p>
          <div className="grid gap-4 sm:grid-cols-12">
            <div className="sm:col-span-3">
              <Label htmlFor="compte-numero2">N°</Label>
              <Input
                id="compte-numero2"
                value={v.numero2}
                onChange={(e) => onChange({ numero2: e.target.value })}
              />
            </div>
            <div className="sm:col-span-9">
              <Label htmlFor="compte-voie2">Voie</Label>
              <Input
                id="compte-voie2"
                value={v.voie2}
                onChange={(e) => onChange({ voie2: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="compte-complement2">Complément d&apos;adresse</Label>
            <Input
              id="compte-complement2"
              value={v.complementAdresse2}
              onChange={(e) => onChange({ complementAdresse2: e.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="compte-cp2">Code postal</Label>
              <Input
                id="compte-cp2"
                inputMode="numeric"
                maxLength={5}
                className={cpInputClass(secondaryCpStatus)}
                value={v.codePostal2}
                onChange={(e) =>
                  onChange({
                    codePostal2: e.target.value.replace(/\D/g, "").slice(0, 5),
                  })
                }
              />
              <PostalCodeCoverageHint status={secondaryCpStatus} />
            </div>
            <div>
              <Label htmlFor="compte-ville2">Ville</Label>
              <Input
                id="compte-ville2"
                value={v.ville2}
                onChange={(e) => onChange({ ville2: e.target.value })}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

