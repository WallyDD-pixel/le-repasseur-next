"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { getUserAccess } from "@/lib/authRedirect";

export function AdminAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<"loading" | "ok">("loading");

  useEffect(() => {
    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, async (u) => {
      if (!u) {
        const ret =
          pathname && pathname.startsWith("/admin")
            ? `?redirect=${encodeURIComponent(pathname)}`
            : "";
        router.replace(`/connexion${ret}`);
        return;
      }
      const access = await getUserAccess(u.uid);
      if (!access.userExists || !access.isAdmin) {
        router.replace("/compte");
        return;
      }
      setState("ok");
    });
  }, [router, pathname]);

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1a2f4d] text-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          <p className="mt-4 text-sm text-white/80">Vérification des droits…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
