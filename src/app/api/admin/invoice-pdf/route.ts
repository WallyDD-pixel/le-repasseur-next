import { NextResponse, type NextRequest } from "next/server";

import { TRANSACTIONS_COLLECTION } from "@/lib/activiteAdmin";
import { requireAdminApiUser } from "@/server/adminApiRouteAuth";
import {
  buildSiteInvoiceData,
  invoicePdfFilename,
} from "@/server/buildSiteInvoiceData";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import { generateSiteInvoicePdf } from "@/server/generateInvoicePdf";

export const runtime = "nodejs";

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function GET(req: NextRequest) {
  const auth = await requireAdminApiUser(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const transactionId =
    req.nextUrl.searchParams.get("transactionId")?.trim() || "";
  if (!transactionId) {
    return NextResponse.json(
      { error: "transactionId manquant." },
      { status: 400 }
    );
  }

  const db = getAdminFirestore();
  if (!db) {
    return NextResponse.json(
      { error: "Firestore Admin indisponible." },
      { status: 503 }
    );
  }

  const txSnap = await db
    .collection(TRANSACTIONS_COLLECTION)
    .doc(transactionId)
    .get();

  if (!txSnap.exists) {
    return NextResponse.json(
      { error: "Transaction introuvable." },
      { status: 404 }
    );
  }

  const tx = txSnap.data() as Record<string, unknown>;
  const userId = str(tx.userId);
  if (!userId) {
    return NextResponse.json(
      { error: "Transaction sans utilisateur associé." },
      { status: 422 }
    );
  }

  const userSnap = await db.collection("users").doc(userId).get();
  const user = (userSnap.data() ?? {}) as Record<string, unknown>;

  const invoiceData = buildSiteInvoiceData(transactionId, tx, user);

  if (invoiceData.totalEuros <= 0) {
    return NextResponse.json(
      { error: "Montant de transaction invalide pour la facture." },
      { status: 422 }
    );
  }

  try {
    const pdfBytes = await generateSiteInvoicePdf(invoiceData);
    const filename = invoicePdfFilename(invoiceData);

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Génération PDF impossible.";
    console.error("[admin/invoice-pdf]", msg, e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
