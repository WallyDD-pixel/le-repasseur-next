"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import {
  getUserAccess,
  type UserAccessResult,
} from "@/lib/authRedirect";
import { siteAsset } from "@/lib/assetBase";

function dashboardHref(a: UserAccessResult): string {
  if (!a.userExists) return "/compte";
  if (a.isAdmin) return "/admin";
  return "/espace-client";
}

function dashboardLabel(a: UserAccessResult): string {
  if (a.isAdmin) return "Administration";
  if (a.userExists) return "Mon espace";
  return "Mon compte";
}

const LEGACY = (path: string) => `https://www.le-repasseur.fr${path}`;

const linkClass =
  "rounded-xl px-3 py-2 text-sm font-medium text-[#10294B]/90 transition hover:bg-[#10294B]/5 hover:text-[#CE2029]";

export function AppHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const [navAccess, setNavAccess] = useState<UserAccessResult | null>(null);
  const [navUser, setNavUser] = useState(false);
  const [navAuthLoading, setNavAuthLoading] = useState(true);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [mobileOpen]);

  useEffect(() => {
    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setNavUser(false);
        setNavAccess(null);
        setNavAuthLoading(false);
        return;
      }
      setNavUser(true);
      setNavAuthLoading(true);
      const a = await getUserAccess(u.uid);
      setNavAccess(a);
      setNavAuthLoading(false);
    });
  }, []);

  const NavDropdown = ({
    label,
    children,
  }: {
    label: string;
    children: React.ReactNode;
  }) => (
    <div className="group relative">
      <button
        type="button"
        className={`${linkClass} inline-flex items-center gap-1`}
        aria-expanded="false"
      >
        {label}
        <svg
          className="h-4 w-4 opacity-60 transition group-hover:rotate-180"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      <div
        className="invisible absolute left-0 top-full z-50 mt-1 min-w-[220px] translate-y-1 rounded-2xl border border-slate-200/80 bg-white/95 py-2 opacity-0 shadow-xl shadow-[#10294B]/10 backdrop-blur-md transition-all duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100"
      >
        {children}
      </div>
    </div>
  );

  return (
    <header className="fixed top-0 z-[100] w-full border-b border-[#10294B]/10 bg-white/85 backdrop-blur-xl">
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#CE2029]/30 to-transparent" />
      <nav className="relative mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center rounded-xl ring-offset-2 transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CE2029]"
        >
          <Image
            src={siteAsset("/assets/imgg/LOGO-LeRepasseur-Fond-Fonce.png")}
            alt="Le Repasseur"
            width={56}
            height={56}
            className="h-12 w-auto sm:h-14"
            priority
            unoptimized
          />
        </Link>

        {/* Desktop */}
        <div className="hidden items-center gap-1 lg:flex">
          <NavDropdown label="Le repasseur">
            <Link href="/#marche" className="block px-4 py-2.5 text-sm text-[#10294B] hover:bg-[#CE2029]/8">
              Comment ça marche ?
            </Link>
            <Link href="/#choisir" className="block px-4 py-2.5 text-sm text-[#10294B] hover:bg-[#CE2029]/8">
              Pourquoi choisir le Repasseur
            </Link>
          </NavDropdown>
          <NavDropdown label="Tarifs">
            <Link href="/#abonnements" className="block px-4 py-2.5 text-sm text-[#10294B] hover:bg-[#CE2029]/8">
              Abonnements
            </Link>
            <Link href="/#collecte" className="block px-4 py-2.5 text-sm text-[#10294B] hover:bg-[#CE2029]/8">
              Collecte sans abonnement
            </Link>
            <Link href="/#offres" className="block px-4 py-2.5 text-sm text-[#10294B] hover:bg-[#CE2029]/8">
              Comparer les offres
            </Link>
            <Link href="/#kit" className="block px-4 py-2.5 text-sm text-[#10294B] hover:bg-[#CE2029]/8">
              Kit du repasseur
            </Link>
          </NavDropdown>
          <Link href="/#telecharger" className={linkClass}>
            Télécharger l&apos;appli
          </Link>
          <Link href="/contact" className={linkClass}>
            Contact
          </Link>
          <a
            href={LEGACY("/faq.html")}
            className="ml-1 rounded-full bg-[#5a5a5a] px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-[#454545]"
          >
            FAQ
          </a>
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          {navAuthLoading ? (
            <span className="px-3 text-sm text-slate-500">Chargement…</span>
          ) : !navUser ? (
            <>
              <Link
                href="/compte"
                className="rounded-xl px-4 py-2 text-sm font-semibold text-[#10294B] transition hover:bg-[#10294B]/5"
              >
                Tableau de bord
              </Link>
              <Link
                href="/inscription"
                className="rounded-xl bg-[#CE2029] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#CE2029]/25 transition hover:bg-[#b91b24]"
              >
                Créer un compte
              </Link>
              <Link
                href="/connexion"
                className="rounded-xl border-2 border-[#10294B]/20 px-4 py-2 text-sm font-semibold text-[#10294B] transition hover:border-[#10294B]/40 hover:bg-[#10294B]/5"
              >
                Se connecter
              </Link>
            </>
          ) : (
            <>
                {!navAccess ? (
                <span className="px-3 text-sm text-slate-500">Chargement…</span>
              ) : (
                <Link
                  href={dashboardHref(navAccess)}
                  className="rounded-xl bg-[#CE2029] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#CE2029]/25 transition hover:bg-[#b91b24]"
                >
                  {dashboardLabel(navAccess)}
                </Link>
              )}
              <Link
                href="/compte"
                className="rounded-xl px-4 py-2 text-sm font-semibold text-[#10294B] transition hover:bg-[#10294B]/5"
              >
                Profil
              </Link>
              <button
                type="button"
                onClick={() => signOut(getFirebaseAuth())}
                className="rounded-xl border-2 border-[#10294B]/20 px-4 py-2 text-sm font-semibold text-[#10294B] transition hover:border-[#10294B]/40 hover:bg-[#10294B]/5"
              >
                Déconnexion
              </button>
            </>
          )}
        </div>

        <button
          type="button"
          className="inline-flex flex-col justify-center gap-1.5 rounded-xl border border-[#10294B]/15 p-3 lg:hidden"
          aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
        >
          <span
            className={`h-0.5 w-6 rounded-full bg-[#10294B] transition ${mobileOpen ? "translate-y-2 rotate-45" : ""}`}
          />
          <span
            className={`h-0.5 w-6 rounded-full bg-[#10294B] transition ${mobileOpen ? "opacity-0" : ""}`}
          />
          <span
            className={`h-0.5 w-6 rounded-full bg-[#10294B] transition ${mobileOpen ? "-translate-y-2 -rotate-45" : ""}`}
          />
        </button>
      </nav>

      {/* Mobile panel */}
      <div
        className={`fixed inset-0 top-[57px] z-[90] bg-[#10294B]/40 backdrop-blur-sm lg:hidden ${
          mobileOpen ? "opacity-100" : "hidden"
        }`}
        aria-hidden={!mobileOpen}
        onClick={() => setMobileOpen(false)}
      />
      <div
        className={`fixed inset-x-0 top-[57px] z-[95] overflow-y-auto border-b border-[#10294B]/10 bg-white shadow-2xl lg:hidden ${
          mobileOpen
            ? "max-h-[calc(100dvh-57px)] opacity-100"
            : "hidden"
        }`}
      >
        <div className="space-y-1 px-4 py-4">
          <p className="px-3 text-xs font-bold uppercase tracking-wider text-[#CE2029]">
            Le repasseur
          </p>
          <Link href="/#marche" className="block rounded-xl px-3 py-3 text-[#10294B] hover:bg-slate-50">
            Comment ça marche ?
          </Link>
          <Link href="/#choisir" className="block rounded-xl px-3 py-3 text-[#10294B] hover:bg-slate-50">
            Pourquoi choisir le Repasseur
          </Link>
          <p className="mt-4 px-3 text-xs font-bold uppercase tracking-wider text-[#CE2029]">
            Tarifs
          </p>
          <Link href="/#abonnements" className="block rounded-xl px-3 py-3 text-[#10294B] hover:bg-slate-50">
            Abonnements
          </Link>
          <Link href="/#collecte" className="block rounded-xl px-3 py-3 text-[#10294B] hover:bg-slate-50">
            Collecte sans abonnement
          </Link>
          <Link href="/#offres" className="block rounded-xl px-3 py-3 text-[#10294B] hover:bg-slate-50">
            Comparer les offres
          </Link>
          <Link href="/#kit" className="block rounded-xl px-3 py-3 text-[#10294B] hover:bg-slate-50">
            Kit du repasseur
          </Link>
          <Link href="/#telecharger" className="block rounded-xl px-3 py-3 text-[#10294B] hover:bg-slate-50">
            Télécharger l&apos;application
          </Link>
          <Link href="/contact" className="block rounded-xl px-3 py-3 text-[#10294B] hover:bg-slate-50">
            Contact
          </Link>
          <a
            href={LEGACY("/faq.html")}
            className="mx-3 mt-2 block rounded-xl bg-[#5a5a5a] py-3 text-center font-semibold text-white"
          >
            FAQ
          </a>
          <div className="mt-6 space-y-2 border-t border-slate-200 pt-4">
            {navAuthLoading ? (
              <p className="py-3 text-center text-sm text-slate-500">
                Chargement…
              </p>
            ) : !navUser ? (
              <>
                <Link
                  href="/compte"
                  className="block rounded-xl px-3 py-3 text-center font-semibold text-[#10294B] hover:bg-slate-50"
                >
                  Tableau de bord
                </Link>
                <Link
                  href="/inscription"
                  className="block rounded-xl bg-[#CE2029] py-3 text-center font-bold text-white"
                >
                  Créer un compte
                </Link>
                <Link
                  href="/connexion"
                  className="block rounded-xl border-2 border-[#10294B]/20 py-3 text-center font-semibold text-[#10294B]"
                >
                  Se connecter
                </Link>
              </>
            ) : (
              <>
                {!navAccess ? (
                  <p className="py-3 text-center text-sm text-slate-500">
                    Chargement…
                  </p>
                ) : (
                  <Link
                    href={dashboardHref(navAccess)}
                    className="block rounded-xl bg-[#CE2029] py-3 text-center font-bold text-white"
                  >
                    {dashboardLabel(navAccess)}
                  </Link>
                )}
                <Link
                  href="/compte"
                  className="block rounded-xl border-2 border-[#10294B]/20 py-3 text-center font-semibold text-[#10294B]"
                >
                  Profil
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    signOut(getFirebaseAuth());
                    setMobileOpen(false);
                  }}
                  className="w-full rounded-xl border-2 border-slate-300 py-3 text-center font-semibold text-slate-700"
                >
                  Déconnexion
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
