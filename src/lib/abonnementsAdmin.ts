import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
  type Firestore,
} from "firebase/firestore";
import { pickStripePriceIdFromFirestoreDoc } from "@/lib/stripePriceIdFromDoc";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFirebaseStorage } from "@/lib/firebase";

/** Collection utilisée sur le site (images accueil, rôles, etc.). */
export const ABONNEMENTS_COLLECTION = "abonnements";

/**
 * Abonnements techniques / partenaires à masquer dans l’UI (liste admin, images home).
 * Ne pas retirer de la logique métier des rôles utilisateurs (`authRedirect`).
 */
export function isHiddenSystemAbonnement(data: Record<string, unknown>): boolean {
  const raw = typeof data.nom === "string" ? data.nom.trim() : "";
  if (!raw) return false;
  const n = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}+/gu, "");
  if (n === "aucun") return true;
  if (n.includes("resodil")) return true;
  return false;
}

export type AbonnementFormValues = {
  nom: string;
  prix: string;
  description: string;
  avantages: string;
  /** Identifiant Stripe `price_…` (paiement Checkout). */
  stripePriceId: string;
};

export function docToFormValues(
  data: Record<string, unknown>
): AbonnementFormValues & { imageUrl?: string } {
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

export function formatPrixBadge(data: Record<string, unknown>): string {
  const p = data.prix ?? data.price;
  if (typeof p === "number") return `${p}€/mois`;
  if (typeof p === "string") {
    const t = p.trim();
    if (!t) return "—";
    return t.includes("€") ? t : `${t}€/mois`;
  }
  return "—";
}

export function avantagesToLines(text: string): string[] {
  if (!text.trim()) return [];
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export function serializePrixForFirestore(
  input: string
): number | string | undefined {
  const t = input.trim();
  if (!t) return undefined;
  const n = parseFloat(t.replace(",", "."));
  if (Number.isFinite(n)) return n;
  return t;
}

export async function uploadAbonnementCoverImage(
  documentId: string,
  file: File
): Promise<string> {
  const storage = getFirebaseStorage();
  const safe = file.name.replace(/[^\w.-]+/g, "_");
  const r = ref(storage, `abonnements/${documentId}/${Date.now()}_${safe}`);
  await uploadBytes(r, file, {
    contentType: file.type || "application/octet-stream",
  });
  return getDownloadURL(r);
}

import {
  legacyDocIdsForPlan,
  nomAliasesForPlan,
  normalizePlanLookupKey,
} from "@/lib/abonnementPlanLookup";

/**
 * Charge un document abonnement à partir du segment d’URL ou du recapPlanId (ex. « Marmo »).
 * Repli : ids legacy (ex. QmRcGWVri4TxnqUQkrVi), puis champ `nom` en base.
 */
export async function resolveAbonnementByRouteId(
  db: Firestore,
  routeId: string
): Promise<{ id: string; data: Record<string, unknown> } | null> {
  const cleaned = normalizePlanLookupKey(routeId);
  if (!cleaned) return null;

  try {
    const direct = await getDoc(doc(db, ABONNEMENTS_COLLECTION, cleaned));
    if (direct.exists()) {
      return { id: direct.id, data: direct.data() as Record<string, unknown> };
    }

    for (const legacyId of legacyDocIdsForPlan(cleaned)) {
      if (legacyId === cleaned) continue;
      const alt = await getDoc(doc(db, ABONNEMENTS_COLLECTION, legacyId));
      if (alt.exists()) {
        return { id: alt.id, data: alt.data() as Record<string, unknown> };
      }
    }

    for (const nom of nomAliasesForPlan(cleaned)) {
      const snap = await getDocs(
        query(
          collection(db, ABONNEMENTS_COLLECTION),
          where("nom", "==", nom),
          limit(1)
        )
      );
      if (!snap.empty) {
        const d = snap.docs[0]!;
        return { id: d.id, data: d.data() as Record<string, unknown> };
      }
    }
    return null;
  } catch {
    return null;
  }
}
