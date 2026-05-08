import type { Metadata } from "next";
import { AdminAppFrame } from "@/components/admin/AdminAppFrame";

export const metadata: Metadata = {
  title: "Administration",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminAppFrame>{children}</AdminAppFrame>;
}
