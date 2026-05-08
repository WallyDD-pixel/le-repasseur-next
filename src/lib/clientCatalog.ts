import type { HomeFirestoreImages } from "@/lib/homeFirestoreImages";

export type CatalogImageKey = keyof Pick<
  HomeFirestoreImages,
  "mino" | "solo" | "duo" | "marmo" | "superHero" | "pack5" | "pack10"
>;

export type ClientCatalogEntry = {
  imageKey: CatalogImageKey;
  name: string;
  priceLine: string;
  detailLine: string;
  bullets: string[];
  badge?: "popular" | "family";
  homeAnchor: string;
  /** Identifiant stable pour Stripe (metadata) et ancienne page récap legacy. */
  recapPlanId: string;
  /** Texte du bouton principal (ex. S'abonner vs Commander) */
  primaryCta?: string;
};

/** Abonnements mensuels — textes alignés sur la page d’accueil publique */
export const CLIENT_SUBSCRIPTION_ITEMS: ClientCatalogEntry[] = [
  {
    imageKey: "mino",
    name: "Mino",
    priceLine: "19€ / mois",
    detailLine: "2,5 kg · 1 collecte · idéal étudiants & vie active",
    bullets: [
      "Sans engagement, résiliable après le 2ᵉ mois",
      "Linge sur cintre ou plié",
      "Retour sous 24h après collecte",
    ],
    homeAnchor: "/#abonnements",
    recapPlanId: "Mino",
  },
  {
    imageKey: "solo",
    name: "Solo",
    priceLine: "39€ / mois",
    detailLine: "5 kg · 1 à 2 collectes · parfait pour une personne",
    bullets: [
      "Kit Repasseur offert",
      "Jusqu’à ~25–35 vêtements / mois",
      "Tarif préférentiel sur les recharges",
    ],
    badge: "popular",
    homeAnchor: "/#abonnements",
    recapPlanId: "Solo",
  },
  {
    imageKey: "duo",
    name: "Duo",
    priceLine: "59€ / mois",
    detailLine: "10 kg · 1 à 4 collectes · couples & petits foyers",
    bullets: [
      "Kit Repasseur offert",
      "Jusqu’à ~50 vêtements / mois",
      "Flexibilité du nombre de collectes",
    ],
    homeAnchor: "/#abonnements",
    recapPlanId: "Duo",
  },
  {
    imageKey: "marmo",
    name: "Marmo",
    priceLine: "99€ / mois",
    detailLine: "20 kg · 1 à 4 collectes · familles",
    bullets: [
      "Kit Repasseur offert",
      "Jusqu’à ~100 vêtements / mois",
      "Meilleur rapport volume / prix",
    ],
    badge: "family",
    homeAnchor: "/#abonnements",
    recapPlanId: "Marmo",
  },
  {
    imageKey: "superHero",
    name: "Super Héros",
    priceLine: "199€ / mois",
    detailLine: "40 kg · 1 à 4 collectes · très gros volumes",
    bullets: [
      "Kit Repasseur offert",
      "Jusqu’à ~200 vêtements / mois",
      "Solution tout inclus pour foyers exigeants",
    ],
    homeAnchor: "/#abonnements",
    recapPlanId: "Super Héros",
  },
];

export const CLIENT_PACK_ITEMS: ClientCatalogEntry[] = [
  {
    imageKey: "pack5",
    name: "Pack 5 kg",
    priceLine: "49€",
    primaryCta: "Commander",
    detailLine: "1 collecte sans abonnement · ~25–35 vêtements",
    bullets: [
      "Idéal pour tester le service",
      "Cintre ou plié au choix",
      "Même qualité de repassage qu’en abonnement",
    ],
    homeAnchor: "/#collecte",
    recapPlanId: "Pack 5 kg",
  },
  {
    imageKey: "pack10",
    name: "Pack 10 kg",
    priceLine: "69€",
    primaryCta: "Commander",
    detailLine: "1 collecte sans abonnement · ~50 vêtements",
    bullets: [
      "Pour un gros volume ponctuel",
      "Parfait avant un déménagement ou une saison",
      "Tarif avantageux au kilo",
    ],
    badge: "popular",
    homeAnchor: "/#collecte",
    recapPlanId: "Pack 10 kg",
  },
];

/** Retrouve une offre catalogue à partir de `recapPlanId` (URL récap, Stripe, etc.). */
export function getCatalogEntryByRecapPlanId(
  recapPlanId: string
): ClientCatalogEntry | undefined {
  const id = recapPlanId.trim();
  return [...CLIENT_SUBSCRIPTION_ITEMS, ...CLIENT_PACK_ITEMS].find(
    (p) => p.recapPlanId === id
  );
}

/** Page tarifs / admin sur le site WordPress (hors flux récap → Stripe). */
export const LEGACY_CHECKOUT_URL = "https://www.le-repasseur.fr/pricing/";

const LEGACY_SITE_ORIGIN = "https://www.le-repasseur.fr";

/** Ancienne page récap sur le site WordPress — utilisée si `CHECKOUT_LEGACY_FALLBACK=1`. */
export function getLegacyRecapUrl(recapPlanId: string): string {
  return `${LEGACY_SITE_ORIGIN}/recap.html?id=${encodeURIComponent(recapPlanId)}`;
}
