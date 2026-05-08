import { getCatalogEntryByRecapPlanId } from "@/lib/clientCatalog";

/** Extrait les euros depuis une ligne catalogue type « 19€ / mois » ou « 49€ ». */
export function euroCentsFromCatalogPriceLine(priceLine: string): number | undefined {
  const compact = priceLine.replace(/\u00a0/g, " ").trim();
  const m = compact.match(/^(\d+(?:[,.]\d+)?)/);
  if (!m) return undefined;
  const euros = parseFloat(m[1]!.replace(",", "."));
  if (!Number.isFinite(euros) || euros <= 0) return undefined;
  return Math.round(euros * 100);
}

/** Montant TTC utilisé pour Stripe `unit_amount`, dérivé du catalogue public (`priceLine`). */
export function euroCentsFromRecapPlanId(planId: string): number | undefined {
  const entry = getCatalogEntryByRecapPlanId(planId);
  if (!entry) return undefined;
  return euroCentsFromCatalogPriceLine(entry.priceLine);
}
