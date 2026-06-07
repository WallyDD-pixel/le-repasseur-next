import { NextResponse, type NextRequest } from "next/server";

import { TRANSACTIONS_COLLECTION } from "@/lib/activiteAdmin";
import { getAdminFirestore, getFirebaseAdminApp } from "@/server/firebaseAdmin";
import { verifyFirebaseUserIdToken } from "@/server/firebaseIdTokenVerify";
import {
  buildSiteInvoiceData,
  invoicePdfFilename,
} from "@/server/buildSiteInvoiceData";
import { generateSiteInvoicePdf } from "@/server/generateInvoicePdf";

export const runtime = "nodejs";

function readIdToken(req: NextRequest): string {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
  return req.nextUrl.searchParams.get("idToken")?.trim() || "";
}

export async function GET(req: NextRequest) {
  const transactionId =
    req.nextUrl.searchParams.get("transactionId")?.trim() || "";
  const idToken = readIdToken(req);

  if (!transactionId) {
    return NextResponse.json(
      { error: "transactionId manquant." },
      { status: 400 }
    );
  }

  if (!getFirebaseAdminApp()) {
    return NextResponse.json(
      { error: "Serveur non configuré (Firebase Admin)." },
      { status: 503 }
    );
  }

  const authUser = idToken ? await verifyFirebaseUserIdToken(idToken) : null;
  if (!authUser) {
    return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
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
  if (str(tx.userId) !== authUser.uid) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const userSnap = await db.collection("users").doc(authUser.uid).get();
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
    console.error("[invoice-pdf]", msg, e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
