import { collection, getDocs } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase";
import { isHiddenSystemAbonnement } from "@/lib/abonnementsAdmin";

export type HomeFirestoreImages = Partial<{
  mino: string;
  solo: string;
  duo: string;
  marmo: string;
  superHero: string;
  pack5: string;
  pack10: string;
  kit: string;
}>;

function normLabel(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}+/gu, "");
}

function pickImageUrl(data: Record<string, unknown>): string | undefined {
  for (const key of [
    "image",
    "imageUrl",
    "photoUrl",
    "photoURL",
    "img",
    "photo",
  ] as const) {
    const v = data[key];
    if (typeof v === "string") {
      const t = v.trim();
      if (t) return t;
    }
  }
  return undefined;
}

type AboKey = keyof Pick<
  HomeFirestoreImages,
  "mino" | "solo" | "duo" | "marmo" | "superHero"
>;

/** IDs de documents (ou anciens repères) → clé affichage */
const AB_ID_TO_KEY: Record<string, AboKey> = {
  Mino: "mino",
  Solo: "solo",
  Duo: "duo",
  QmRcGWVri4TxnqUQkrVi: "marmo",
  "Super hero": "superHero",
};

/**
 * Valeur typique du champ `nom` (normalisée) → clé.
 * Inclut les variantes d’orthographe pour « Super Héros ».
 */
const AB_NOM_NORM_TO_KEY: Partial<Record<string, AboKey>> = {
  mino: "mino",
  solo: "solo",
  duo: "duo",
  marmo: "marmo",
  "super heros": "superHero",
  "super hero": "superHero",
  "super heroes": "superHero",
};

type ProdKey = keyof Pick<
  HomeFirestoreImages,
  "pack5" | "pack10" | "kit"
>;

const PROD_ID_TO_KEY: Record<string, ProdKey> = {
  "pack2.5": "pack5",
  MXRwFhayQhW2U8bxaNXT: "pack10",
  kit: "kit",
};

const PROD_NOM_NORM_TO_KEY: Partial<Record<string, ProdKey>> = {
  "pack 5 kg": "pack5",
  "pack 10 kg": "pack10",
  kit: "kit",
  "kit repasseur": "kit",
};

function resolveAboKey(
  id: string,
  data: Record<string, unknown>
): AboKey | undefined {
  const byId = AB_ID_TO_KEY[id];
  if (byId) return byId;
  const nom = data.nom;
  if (typeof nom === "string" && nom.trim()) {
    return AB_NOM_NORM_TO_KEY[normLabel(nom)];
  }
  return undefined;
}

function resolveProdKey(
  id: string,
  data: Record<string, unknown>
): ProdKey | undefined {
  const byId = PROD_ID_TO_KEY[id];
  if (byId) return byId;
  const nom = data.nom;
  if (typeof nom === "string" && nom.trim()) {
    return PROD_NOM_NORM_TO_KEY[normLabel(nom)];
  }
  return undefined;
}

export async function loadHomeFirestoreImages(): Promise<HomeFirestoreImages> {
  const db = getFirebaseFirestore();
  const out: HomeFirestoreImages = {};

  const [abos, prods] = await Promise.all([
    getDocs(collection(db, "abonnements")),
    getDocs(collection(db, "produits")),
  ]);

  abos.forEach((snap) => {
    const data = snap.data() as Record<string, unknown>;
    if (isHiddenSystemAbonnement(data)) return;
    const url = pickImageUrl(data);
    if (!url) return;
    const key = resolveAboKey(snap.id, data);
    if (key) out[key] = url;
  });

  prods.forEach((snap) => {
    const data = snap.data() as Record<string, unknown>;
    const url = pickImageUrl(data);
    if (!url) return;
    const key = resolveProdKey(snap.id, data);
    if (key) out[key] = url;
  });

  return out;
}
