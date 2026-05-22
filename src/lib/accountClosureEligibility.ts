function pickFirst(data: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (k in data && data[k] != null) return data[k];
  }
  return undefined;
}

/**
 * Quota kg restant — Firestore : champ `collectes`.
 * @see planCreditsResolve.ts
 */
export function parseRemainingKg(userData: Record<string, unknown>): number {
  const raw = pickFirst(userData, [
    "collectes",
    "poidsRestant",
    "kgRestant",
    "quotaKg",
    "kg",
    "poids",
    "poidsKg",
    "weight",
  ]);
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw === "string" && raw.trim()) {
    const n = Number.parseFloat(raw.replace(",", ".").replace(/[^\d.]/g, ""));
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return 0;
}

/** Nombre de collectes restantes — Firestore : champ `reservations`. */
export function parseRemainingPickups(userData: Record<string, unknown>): number {
  const raw = pickFirst(userData, [
    "reservations",
    "reservation",
    "reservationsRestantes",
    "nbReservations",
    "nombreReservations",
    "remainingPickups",
  ]);
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0)
    return Math.floor(raw);
  if (typeof raw === "string" && raw.trim()) {
    const n = Number.parseInt(raw, 10);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return 0;
}

function formatKg(n: number): string {
  const s = Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, "");
  return `${s} kg`;
}

/** Arguments pour encourager l’utilisateur à rester (non bloquants). */
export type RetentionReason = {
  code: "kg" | "pickups";
  highlight: string;
  detail: string;
};

export function getRetentionReasons(
  userData?: Record<string, unknown>
): RetentionReason[] {
  const data = userData ?? {};
  const reasons: RetentionReason[] = [];

  const remainingKg = parseRemainingKg(data);
  if (remainingKg > 0) {
    reasons.push({
      code: "kg",
      highlight: formatKg(remainingKg),
      detail:
        "de linge encore disponibles sur votre quota — profitez-en avant de partir.",
    });
  }

  const remainingPickups = parseRemainingPickups(data);
  if (remainingPickups > 0) {
    const label =
      remainingPickups > 1
        ? `${remainingPickups} collectes`
        : "1 collecte";
    reasons.push({
      code: "pickups",
      highlight: label,
      detail:
        "à planifier dans l’application — votre linge mérite d’être pris en charge.",
    });
  }

  return reasons;
}

/** Seule condition technique : pas d’abonnement actif. */
export function canCloseAccount(params: { isSubscribed: boolean }): boolean {
  return !params.isSubscribed;
}
