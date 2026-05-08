import type { Metadata } from "next";
import { EspaceClientAuthGate } from "@/components/espace-client/EspaceClientAuthGate";

export const metadata: Metadata = {
  title: "Mon espace client",
  robots: { index: false, follow: false },
};

export default function EspaceClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <EspaceClientAuthGate>{children}</EspaceClientAuthGate>;
}
