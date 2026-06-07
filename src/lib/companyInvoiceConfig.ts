/**
 * Coordonnées émetteur des factures PDF (surchargeables via variables d’environnement).
 */
export type CompanyInvoiceInfo = {
  legalName: string;
  tradeName: string;
  addressLine1: string;
  addressLine2: string;
  siret: string;
  tvaIntra: string;
  email: string;
  phone: string;
  website: string;
  /** Mention TVA / franchise en base (ex. art. 293 B du CGI). */
  vatMention: string;
  /** IBAN optionnel (affiché en pied de page si renseigné). */
  iban: string;
};

function env(key: string, fallback: string): string {
  const v = process.env[key]?.trim();
  return v || fallback;
}

export function getCompanyInvoiceInfo(): CompanyInvoiceInfo {
  return {
    legalName: env("COMPANY_LEGAL_NAME", "Umbrella Services"),
    tradeName: env("COMPANY_TRADE_NAME", "Le Repasseur"),
    addressLine1: env("COMPANY_ADDRESS_LINE1", "15 Avenue Thiers"),
    addressLine2: env("COMPANY_ADDRESS_LINE2", "06600 Antibes"),
    siret: env("COMPANY_SIRET", ""),
    tvaIntra: env("COMPANY_TVA_INTRA", ""),
    email: env("COMPANY_EMAIL", "contact@le-repasseur.fr"),
    phone: env("COMPANY_PHONE", "07 67 12 36 39"),
    website: env("COMPANY_WEBSITE", "www.le-repasseur.fr"),
    vatMention: env(
      "COMPANY_VAT_MENTION",
      "TVA non applicable, article 293 B du Code général des impôts."
    ),
    iban: env("COMPANY_IBAN", ""),
  };
}
