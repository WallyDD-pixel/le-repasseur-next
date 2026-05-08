/**
 * Appelle l’API de création de session Stripe Checkout (réutilisable page récap + ailleurs).
 */
export async function requestStripeCheckoutSession(
  planId: string,
  options?: { idToken?: string | null }
): Promise<
  | { ok: true; redirectUrl: string }
  | { ok: false; error: string }
> {
  try {
    const payload: Record<string, string> = { planId };
    const tok = options?.idToken?.trim();
    if (tok) payload.idToken = tok;

    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data: { url?: string; legacyUrl?: string; error?: string } =
      await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        error:
          typeof data.error === "string"
            ? data.error
            : "Paiement temporairement indisponible.",
      };
    }
    if (typeof data.legacyUrl === "string" && data.legacyUrl) {
      return { ok: true, redirectUrl: data.legacyUrl };
    }
    if (typeof data.url === "string" && data.url) {
      return { ok: true, redirectUrl: data.url };
    }
    return { ok: false, error: "Réponse serveur inattendue." };
  } catch {
    return { ok: false, error: "Connexion impossible. Réessayez dans un instant." };
  }
}
