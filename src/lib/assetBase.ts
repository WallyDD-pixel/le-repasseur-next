/** Fichiers /assets du site actuel (images, etc.) */
export const SITE_ASSET_BASE =
  process.env.NEXT_PUBLIC_SITE_ASSET_BASE ?? "https://www.le-repasseur.fr";

export function siteAsset(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_ASSET_BASE}${p}`;
}
