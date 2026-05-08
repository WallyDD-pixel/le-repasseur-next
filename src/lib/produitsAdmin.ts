import { doc, getDoc, type Firestore } from "firebase/firestore";
import { pickStripePriceIdFromFirestoreDoc } from "@/lib/stripePriceIdFromDoc";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFirebaseStorage } from "@/lib/firebase";

/** Catalogue boutique / packs (legacy Flutter + Admin.html). */
export const PRODUITS_COLLECTION = "produits";

export type ProduitFormValues = {
  nom: string;
  prix: string;
  description: string;
  avantages: string;
  /** Identifiant Stripe `price_…` (paiement Checkout). */
  stripePriceId: string;
};

export function docToProduitFormValues(
  data: Record<string, unknown>
): ProduitFormValues & { imageUrl?: string } {
  const nom = typeof data.nom === "string" ? data.nom : "";
  const description =
    typeof data.description === "string"
      ? data.description
      : typeof data.desc === "string"
        ? data.desc
        : "";
  const avantages =
    typeof data.avantages === "string"
      ? data.avantages
      : typeof data.avantage === "string"
        ? data.avantage
        : "";
  const prixRaw = data.prix ?? data.price;
  let prix = "";
  if (typeof prixRaw === "number") prix = String(prixRaw);
  else if (typeof prixRaw === "string") {
    prix = prixRaw.replace(/[^\d.,]/g, "").replace(",", ".").trim();
    const n = parseFloat(prix);
    prix = Number.isFinite(n) ? String(Math.round(n * 100) / 100) : prixRaw;
  }
  const imageUrl =
    typeof data.image === "string"
      ? data.image
      : typeof data.imageUrl === "string"
        ? data.imageUrl
        : undefined;

  const stripePriceId = pickStripePriceIdFromFirestoreDoc(data) ?? "";

  return { nom, prix, description, avantages, stripePriceId, imageUrl };
}

/** Affichage type fiche produit (prix unique, pas « / mois »). */
export function formatProduitPrixBadge(data: Record<string, unknown>): string {
  const p = data.prix ?? data.price;
  if (typeof p === "number") return `${p}€`;
  if (typeof p === "string") {
    const t = p.trim();
    if (!t) return "—";
    return t.includes("€") ? t : `${t}€`;
  }
  return "—";
}

export { serializePrixForFirestore } from "@/lib/abonnementsAdmin";

export async function uploadProduitCoverImage(
  documentId: string,
  file: File
): Promise<string> {
  const storage = getFirebaseStorage();
  const safe = file.name.replace(/[^\w.-]+/g, "_");
  const r = ref(storage, `produits/${documentId}/${Date.now()}_${safe}`);
  await uploadBytes(r, file, {
    contentType: file.type || "application/octet-stream",
  });
  return getDownloadURL(r);
}

function normalizeRouteDocId(routeId: string): string {
  return routeId.trim().replace(/\+/g, " ");
}

export async function resolveProduitByRouteId(
  db: Firestore,
  routeId: string
): Promise<{ id: string; data: Record<string, unknown> } | null> {
  const cleaned = normalizeRouteDocId(routeId);
  if (!cleaned) return null;
  try {
    const direct = await getDoc(doc(db, PRODUITS_COLLECTION, cleaned));
    if (direct.exists()) {
      return { id: direct.id, data: direct.data() as Record<string, unknown> };
    }
    return null;
  } catch {
    return null;
  }
}
