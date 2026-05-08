"use client";

import { usePathname } from "next/navigation";
import { AppFooter } from "@/components/shell/AppFooter";
import { AppHeader } from "@/components/shell/AppHeader";

export function LayoutChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideSiteChrome = pathname.startsWith("/admin");

  if (hideSiteChrome) {
    return <>{children}</>;
  }

  return (
    <>
      <AppHeader />
      {children}
      <AppFooter />
    </>
  );
}
