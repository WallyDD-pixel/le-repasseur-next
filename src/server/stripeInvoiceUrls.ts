import type Stripe from "stripe";

export type StripeInvoiceUrls = {
  hosted: string | null;
  pdf: string | null;
};

export function urlsFromStripeInvoice(invoice: Stripe.Invoice): StripeInvoiceUrls {
  const hosted =
    typeof invoice.hosted_invoice_url === "string"
      ? invoice.hosted_invoice_url.trim()
      : "";
  const pdf =
    typeof invoice.invoice_pdf === "string" ? invoice.invoice_pdf.trim() : "";
  return {
    hosted: hosted || null,
    pdf: pdf || null,
  };
}

export async function fetchStripeInvoiceUrls(
  stripe: Stripe,
  invoiceId: string
): Promise<StripeInvoiceUrls> {
  const invoice = await stripe.invoices.retrieve(invoiceId);
  return urlsFromStripeInvoice(invoice);
}

export function invoiceUrlFields(
  urls: StripeInvoiceUrls
): Record<string, string> {
  const out: Record<string, string> = {};
  if (urls.hosted) out.invoiceHostedUrl = urls.hosted;
  if (urls.pdf) out.invoicePdfUrl = urls.pdf;
  return out;
}
