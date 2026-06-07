/** Communes couvertes — aligné sur l’ancienne page commune.html */
export type CoveredCommune = {
  postalCodes: string[];
  city: string;
};

export const COVERED_COMMUNES: CoveredCommune[] = [
  { postalCodes: ["06200", "06000", "06300", "06100"], city: "Nice" },
  { postalCodes: ["06160", "06600"], city: "Antibes" },
  { postalCodes: ["06150", "06400"], city: "Cannes" },
  { postalCodes: ["06520", "06130"], city: "Grasse" },
  { postalCodes: ["06800"], city: "Cagnes-sur-Mer" },
  { postalCodes: ["06110"], city: "Le Cannet" },
  { postalCodes: ["06700"], city: "Saint-Laurent-du-Var" },
  { postalCodes: ["06220"], city: "Vallauris" },
  { postalCodes: ["06210"], city: "Mandelieu-la-Napoule" },
  { postalCodes: ["06250"], city: "Mougins" },
  { postalCodes: ["06270"], city: "Villeneuve-Loubet" },
  { postalCodes: ["06560"], city: "Valbonne" },
  { postalCodes: ["06370"], city: "Mouans-Sartoux" },
  { postalCodes: ["06410"], city: "Biot" },
  { postalCodes: ["06580"], city: "Pégomas" },
  { postalCodes: ["06550"], city: "La Roquette-sur-Siagne" },
  { postalCodes: ["06590"], city: "Théoule-sur-Mer" },
  // Var (83)
  { postalCodes: ["83600"], city: "Fréjus" },
  { postalCodes: ["83700", "83530"], city: "Saint-Raphaël" },
  { postalCodes: ["83370"], city: "Saint-Aygulf" },
  { postalCodes: ["83520"], city: "Roquebrune-sur-Argens" },
  { postalCodes: ["83480", "83099"], city: "Puget-sur-Argens" },
  { postalCodes: ["83120"], city: "Sainte-Maxime" },
];

const COVERED_SET = new Set(
  COVERED_COMMUNES.flatMap((c) => c.postalCodes)
);

/** Normalise un code postal saisi (5 chiffres). */
export function normalizePostalCode(raw: string): string {
  return raw.replace(/\s/g, "").trim();
}

export function isPostalCodeCovered(raw: string): boolean {
  return postalCodeCoverageStatus(raw) === "covered";
}

/** Commune desservie pour un code postal couvert (sinon `null`). */
export function cityForPostalCode(raw: string): string | null {
  const cp = normalizePostalCode(raw);
  if (!/^\d{5}$/.test(cp)) return null;
  const commune = COVERED_COMMUNES.find((c) => c.postalCodes.includes(cp));
  return commune?.city ?? null;
}

/** Vérification basée uniquement sur les 5 chiffres du code postal. */
export type PostalCoverageStatus = "incomplete" | "covered" | "not_covered";

export function postalCodeCoverageStatus(raw: string): PostalCoverageStatus {
  const cp = normalizePostalCode(raw);
  if (!/^\d{5}$/.test(cp)) return "incomplete";
  return COVERED_SET.has(cp) ? "covered" : "not_covered";
}

export const MESSAGE_CP_HORS_SECTEUR =
  "Ce code postal n’est pas encore dans notre zone de collecte. Vous pouvez continuer votre inscription : nous vous préviendrons dès que le service sera disponible dans votre ville.";

export const MESSAGE_CP_COUVERT =
  "Ce code postal fait partie de notre secteur desservi.";
