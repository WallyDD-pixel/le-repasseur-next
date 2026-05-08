/**
 * Cible après connexion : chemins internes autorisés uniquement (pas d’open redirect).
 */
export function safeEspaceClientRedirectPath(raw: string | null): string | null {
  if (raw == null || raw.trim() === "") return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw.trim());
  } catch {
    return null;
  }
  if (!decoded.startsWith("/")) return null;
  if (decoded.startsWith("//")) return null;
  if (decoded.includes("://")) return null;
  if (decoded.includes("..")) return null;

  if (
    decoded.startsWith("/espace-client/") ||
    decoded === "/espace-client" ||
    decoded.startsWith("/admin/") ||
    decoded === "/admin"
  ) {
    return decoded;
  }
  return null;
}
