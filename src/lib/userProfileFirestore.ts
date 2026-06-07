import { deleteField } from "firebase/firestore";

import { isPostalCodeCovered, normalizePostalCode } from "@/lib/coveredPostalCodes";

function str(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return String(v);
}

function pickFirst(data: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (k in data && data[k] != null) return data[k];
  }
  return undefined;
}

export type UserAddressForm = {
  societe: string;
  numero: string;
  voie: string;
  complementAdresse: string;
  codePostal: string;
  ville: string;
  adresseSecondaire: "non" | "oui";
  numero2: string;
  voie2: string;
  complementAdresse2: string;
  codePostal2: string;
  ville2: string;
};

export type UserProfileForm = UserAddressForm & {
  prenom: string;
  nom: string;
  telephone: string;
};

function mergeAddressRoot(data: Record<string, unknown>): Record<string, unknown> {
  const nested = data.adresse;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return { ...(nested as Record<string, unknown>), ...data };
  }
  return data;
}

function secondaryAddressRecord(
  data: Record<string, unknown>
): Record<string, unknown> {
  const details = data.adresseSecondaireDetails;
  if (details && typeof details === "object" && !Array.isArray(details)) {
    return details as Record<string, unknown>;
  }
  const nested = data.adresse2;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  return data;
}

export function userAddressFromFirestore(
  data: Record<string, unknown>
): UserAddressForm {
  const root = mergeAddressRoot(data);
  const sec = secondaryAddressRecord(data);

  const hasSecondary =
    data.adresseSecondaire === true ||
    data.adresseSecondaire === "oui" ||
    str(data.adresseSecondaire).toLowerCase() === "true" ||
    str(sec.numero ?? data.numero2).length > 0 ||
    str(sec.voie ?? data.voie2).length > 0;

  return {
    societe: str(root.societe),
    numero: str(pickFirst(root, ["numero", "numeroRue", "streetNumber"])),
    voie: str(pickFirst(root, ["voie", "rue", "adresse", "street"])),
    complementAdresse: str(
      pickFirst(root, ["complementAdresse", "complement", "complement_adresse"])
    ),
    codePostal: str(
      pickFirst(root, ["codePostal", "cp", "zip", "postalCode", "code_postal"])
    ),
    ville: str(root.ville),
    adresseSecondaire: hasSecondary ? "oui" : "non",
    numero2: str(pickFirst(sec, ["numero", "numeroRue"]) || data.numero2),
    voie2: str(
      pickFirst(sec, ["voie", "rue", "adresse", "street"]) || data.voie2
    ),
    complementAdresse2: str(
      pickFirst(sec, ["complementAdresse", "complement", "complement_adresse"]) ||
        data.complementAdresse2
    ),
    codePostal2: str(
      pickFirst(sec, ["codePostal", "cp", "zip"]) || data.codePostal2 || data.cp2
    ),
    ville2: str(sec.ville ?? data.ville2),
  };
}

export function userProfileFromFirestore(
  data: Record<string, unknown>
): UserProfileForm {
  return {
    prenom: str(data.prenom),
    nom: str(data.nom),
    telephone: str(pickFirst(data, ["telephone", "tel", "phone"])),
    ...userAddressFromFirestore(data),
  };
}

export function validateUserProfileForm(
  form: UserProfileForm
): { ok: true } | { ok: false; error: string } {
  const cp = normalizePostalCode(form.codePostal);
  if (!/^\d{5}$/.test(cp)) {
    return { ok: false, error: "Code postal invalide (5 chiffres)." };
  }
  if (!form.ville.trim()) {
    return { ok: false, error: "Indiquez votre ville." };
  }
  if (!form.numero.trim() || !form.voie.trim()) {
    return { ok: false, error: "Indiquez le numéro et la voie de votre adresse." };
  }

  if (form.adresseSecondaire === "oui") {
    const cp2 = normalizePostalCode(form.codePostal2);
    if (!/^\d{5}$/.test(cp2)) {
      return {
        ok: false,
        error: "Code postal de l’adresse secondaire invalide (5 chiffres).",
      };
    }
    if (!form.numero2.trim() || !form.voie2.trim() || !form.ville2.trim()) {
      return {
        ok: false,
        error: "Renseignez l’adresse secondaire (N°, voie et ville).",
      };
    }
  }

  return { ok: true };
}

/** Payload Firestore pour `updateDoc` sur `users/{uid}`. */
export function buildUserProfileUpdate(
  form: UserProfileForm
): Record<string, unknown> {
  const cp = normalizePostalCode(form.codePostal);
  const covered = isPostalCodeCovered(cp);
  const wantsSecondary = form.adresseSecondaire === "oui";

  const payload: Record<string, unknown> = {
    prenom: form.prenom.trim(),
    nom: form.nom.trim(),
    telephone: form.telephone.trim(),
    societe: form.societe.trim(),
    numero: form.numero.trim(),
    voie: form.voie.trim(),
    complementAdresse: form.complementAdresse.trim(),
    codePostal: cp,
    ville: form.ville.trim(),
    adresseSecondaire: wantsSecondary,
    secteurCouvert: covered,
  };

  if (wantsSecondary) {
    const cp2 = normalizePostalCode(form.codePostal2);
    payload.adresseSecondaireDetails = {
      numero: form.numero2.trim(),
      voie: form.voie2.trim(),
      complementAdresse: form.complementAdresse2.trim(),
      codePostal: cp2,
      ville: form.ville2.trim(),
    };
  } else {
    payload.adresseSecondaireDetails = deleteField();
  }

  return payload;
}
