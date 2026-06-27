/**
 * Journal d’audit des quotas utilisateur (kg + collectes).
 * Firestore : `collectes` = kg restants, `reservations` = collectes restantes.
 */
export const USER_QUOTA_AUDIT_COLLECTION = "journal_quotas";

export type QuotaSnapshot = {
  collectesKg: number;
  reservations: number;
  role?: string;
};

export type UserQuotaAuditSource =
  | "stripe_checkout"
  | "stripe_webhook_renewal"
  | "admin_manual"
  | "sync_stripe"
  | "inscription"
  | "migration";

export type UserQuotaAuditAction = "increment" | "set" | "init";

export type UserQuotaAuditEntry = {
  userId: string;
  email?: string;
  source: UserQuotaAuditSource;
  action: UserQuotaAuditAction;
  before: QuotaSnapshot;
  after: QuotaSnapshot;
  delta?: {
    collectesKg?: number;
    reservations?: number;
  };
  planId?: string;
  txDocId?: string;
  stripeInvoiceId?: string;
  stripeCheckoutSessionId?: string;
  note?: string;
  actor?: string;
};

export function coerceQuotaNumber(raw: unknown, fallback = 0): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const n = Number.parseFloat(raw.replace(",", ".").trim());
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

export function coerceQuotaReservations(raw: unknown): number {
  const n = coerceQuotaNumber(raw, 0);
  return n >= 0 ? Math.floor(n) : 0;
}

export function quotaSnapshotFromUserData(
  data: Record<string, unknown> | undefined | null
): QuotaSnapshot {
  if (!data) {
    return { collectesKg: 0, reservations: 0 };
  }
  const role = typeof data.role === "string" ? data.role.trim() : undefined;
  return {
    collectesKg: coerceQuotaNumber(data.collectes ?? data.kg, 0),
    reservations: coerceQuotaReservations(data.reservations),
    ...(role ? { role } : {}),
  };
}

export function buildQuotaAuditEntry(
  params: UserQuotaAuditEntry
): UserQuotaAuditEntry {
  return params;
}
