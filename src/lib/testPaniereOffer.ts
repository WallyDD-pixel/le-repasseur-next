import { collection, getDocs, limit, query, where, type Firestore } from "firebase/firestore";
import type { ClientCatalogEntry } from "@/lib/clientCatalog";
import { PRODUITS_COLLECTION } from "@/lib/produitsAdmin";

/** Fiche Firestore `produits` — « Première panière test ». */
export const TEST_PANIERE_PRODUCT_NOM = "Première panière test";

export const TEST_PANIERE_RECAP_PLAN_ID = TEST_PANIERE_PRODUCT_NOM;

const LEGACY_TEST_PLAN_IDS = new Set(["Essai 1€"]);

export function isTestOfferPlanId(planId: string): boolean {
  const id = planId.trim();
  return id === TEST_PANIERE_RECAP_PLAN_ID || LEGACY_TEST_PLAN_IDS.has(id);
}

function readPositiveNumber(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw === "string") {
    const n = Number.parseFloat(raw.replace(",", ".").trim());
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function splitBullets(avantages: string): string[] {
  return avantages
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatKgLabel(kg: number): string {
  const s = Number.isInteger(kg) ? String(kg) : String(kg).replace(".", ",");
  return `${s} kg`;
}

/** Convertit la fiche produit Firestore en carte catalogue espace client. */
export function produitDocToTestCatalogEntry(
  data: Record<string, unknown>
): ClientCatalogEntry {
  const nom =
    typeof data.nom === "string" && data.nom.trim()
      ? data.nom.trim()
      : TEST_PANIERE_PRODUCT_NOM;
  const prixRaw = data.prix ?? data.price;
  let prixNum = 1;
  if (typeof prixRaw === "number" && Number.isFinite(prixRaw)) prixNum = prixRaw;
  else if (typeof prixRaw === "string") {
    const n = Number.parseFloat(prixRaw.replace(",", ".").trim());
    if (Number.isFinite(n)) prixNum = n;
  }

  const kg = readPositiveNumber(data.kg) ?? 2.5;
  const collecte =
    readPositiveNumber(data.collecte ?? data.collectes) ?? 1;
  const description =
    typeof data.description === "string" ? data.description.trim() : "";
  const avantages =
    typeof data.avantages === "string"
      ? data.avantages
      : typeof data.avantage === "string"
        ? data.avantage
        : "";
  const bullets = splitBullets(avantages);
  const imageUrl =
    typeof data.image === "string"
      ? data.image
      : typeof data.imageUrl === "string"
        ? data.imageUrl
        : undefined;

  const detailLine =
    description ||
    `${formatKgLabel(kg)} · ${collecte} collecte${collecte > 1 ? "s" : ""} · pour ${prixNum}€`;

  return {
    imageKey: "pack5",
    imageUrl,
    name: nom,
    priceLine: `${prixNum}€`,
    primaryCta: "Essayer pour 1 €",
    detailLine,
    bullets: bullets.length > 0 ? bullets : [detailLine],
    badge: "test",
    homeAnchor: "/#collecte",
    recapPlanId: nom,
  };
}

export async function fetchTestPaniereCatalogEntry(
  db: Firestore
): Promise<ClientCatalogEntry | null> {
  try {
    const byNom = await getDocs(
      query(
        collection(db, PRODUITS_COLLECTION),
        where("nom", "==", TEST_PANIERE_PRODUCT_NOM),
        limit(1)
      )
    );
    if (!byNom.empty) {
      return produitDocToTestCatalogEntry(
        byNom.docs[0]!.data() as Record<string, unknown>
      );
    }

    const byPrix = await getDocs(
      query(
        collection(db, PRODUITS_COLLECTION),
        where("prix", "==", 1),
        limit(5)
      )
    );
    for (const d of byPrix.docs) {
      const data = d.data() as Record<string, unknown>;
      const n = typeof data.nom === "string" ? data.nom.toLowerCase() : "";
      if (n.includes("test") || n.includes("première") || n.includes("panière")) {
        return produitDocToTestCatalogEntry(data);
      }
    }
  } catch {
    return null;
  }
  return null;
}
