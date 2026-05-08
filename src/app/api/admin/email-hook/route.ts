import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiUser } from "@/server/adminApiRouteAuth";

/**
 * Proxy POST vers une Cloud Function (évite CORS depuis le navigateur).
 * Authentification admin obligatoire + URL limitée aux domaines Firebase / GCP.
 */
function isAllowedHookUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const h = u.hostname;
    return (
      h.endsWith(".cloudfunctions.net") ||
      h.endsWith(".run.app") ||
      h === "localhost"
    );
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminApiUser(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Corps attendu : objet." }, { status: 400 });
  }
  const url =
    typeof (body as { url?: unknown }).url === "string"
      ? (body as { url: string }).url.trim()
      : "";
  const payload = (body as { payload?: unknown }).payload ?? {};
  if (!url || !isAllowedHookUrl(url)) {
    return NextResponse.json(
      {
        error:
          "URL HTTPS requise (ex. *.cloudfunctions.net ou *.run.app).",
      },
      { status: 400 }
    );
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      body: text.slice(0, 4000),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Échec réseau.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
