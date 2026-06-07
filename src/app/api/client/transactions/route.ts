import { NextResponse, type NextRequest } from "next/server";

import { TRANSACTIONS_COLLECTION } from "@/lib/activiteAdmin";
import {
  mapFirestoreTxToClientRow,
  type ClientTransactionRow,
} from "@/lib/clientTransactions";
import { getAdminFirestore, getFirebaseAdminApp } from "@/server/firebaseAdmin";
import { verifyFirebaseUserIdToken } from "@/server/firebaseIdTokenVerify";

function readIdToken(req: NextRequest): string {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
  return "";
}

export async function GET(req: NextRequest) {
  const idToken =
    readIdToken(req) || req.nextUrl.searchParams.get("idToken")?.trim() || "";

  if (!getFirebaseAdminApp()) {
    return NextResponse.json(
      { error: "Serveur non configuré (Firebase Admin)." },
      { status: 503 }
    );
  }

  const user = idToken ? await verifyFirebaseUserIdToken(idToken) : null;
  if (!user) {
    return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  }

  const db = getAdminFirestore();
  if (!db) {
    return NextResponse.json(
      { error: "Firestore Admin indisponible." },
      { status: 503 }
    );
  }

  const snap = await db
    .collection(TRANSACTIONS_COLLECTION)
    .where("userId", "==", user.uid)
    .get();

  const rows: ClientTransactionRow[] = snap.docs.map((doc) =>
    mapFirestoreTxToClientRow(doc.id, doc.data() as Record<string, unknown>)
  );

  rows.sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));

  return NextResponse.json({
    ok: true,
    rows: rows.map((r) => ({
      id: r.id,
      date: r.date?.toISOString() ?? null,
      type: r.type,
      titre: r.titre,
      montantDisplay: r.montantDisplay,
    })),
  });
}
