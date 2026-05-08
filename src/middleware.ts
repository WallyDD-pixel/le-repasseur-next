import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * En-têtes de sécurité de base + zone admin non indexable.
 * L’auth Firebase reste côté client / routes API (jetons vérifiés avec Admin SDK).
 */
export function middleware(request: NextRequest) {
  const res = NextResponse.next();

  res.headers.set("X-Frame-Options", "SAMEORIGIN");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );
  res.headers.set("X-DNS-Prefetch-Control", "on");

  if (request.nextUrl.pathname.startsWith("/admin")) {
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  if (process.env.NODE_ENV === "production") {
    res.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
