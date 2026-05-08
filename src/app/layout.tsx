import type { Metadata } from "next";
import { DM_Sans, Lobster } from "next/font/google";
import "./globals.css";
import { LayoutChrome } from "@/components/layout/LayoutChrome";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const lobster = Lobster({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-lobster",
});

export const metadata: Metadata = {
  title: {
    default: "Le Repasseur — Repassage à domicile",
    template: "%s | Le Repasseur",
  },
  description:
    "Service de repassage et soin du linge à domicile. Réservation simple, qualité professionnelle.",
  metadataBase: new URL("https://www.le-repasseur.fr"),
  openGraph: {
    siteName: "Le Repasseur",
    locale: "fr_FR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className={`${dmSans.variable} ${lobster.variable} min-h-screen font-sans antialiased`}
      >
        <LayoutChrome>
          <main className="flex-1">{children}</main>
        </LayoutChrome>
      </body>
    </html>
  );
}
