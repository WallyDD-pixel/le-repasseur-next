/**
 * Base des images statiques (/assets/imgg/…).
 * Vide = fichiers dans `public/` (Vercel, prod). Ancien site OVH : définir
 * NEXT_PUBLIC_SITE_ASSET_BASE=https://www.le-repasseur.fr uniquement en dev local
 * si les fichiers ne sont pas encore dans public/.
 */
export const SITE_ASSET_BASE =
  process.env.NEXT_PUBLIC_SITE_ASSET_BASE?.trim() ?? "";

export function siteAsset(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!SITE_ASSET_BASE) return p;
  return `${SITE_ASSET_BASE.replace(/\/$/, "")}${p}`;
}
