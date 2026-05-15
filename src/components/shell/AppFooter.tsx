import Image from "next/image";
import Link from "next/link";
import { siteAsset } from "@/lib/assetBase";

const LEGACY = (path: string) => `https://www.le-repasseur.fr${path}`;

export function AppFooter() {
  return (
    <footer className="relative mt-auto border-t border-[#10294B]/10 bg-gradient-to-b from-[#f8f9fb] to-[#eef1f6]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#CE2029]/40 to-transparent" />
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="mb-10 flex flex-col items-center gap-6 border-b border-[#10294B]/10 pb-10 text-center md:flex-row md:justify-between md:text-left">
          <div>
            <p className="font-lobster text-2xl text-[#10294B]">Le Repasseur</p>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-600">
              Repassage professionnel à Antibes — collecte et livraison à domicile.
              Vite fait, bien fait, sans vous déplacer.
            </p>
          </div>
          <Link href="/" className="shrink-0">
            <Image
              src={siteAsset("/assets/imgg/LOGO-LeRepasseur-FondBlanc.png")}
              alt="Le Repasseur"
              width={100}
              height={120}
              className="h-24 w-auto drop-shadow-md"
              unoptimized
            />
          </Link>
        </div>

        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[#CE2029]">
              Navigation
            </h3>
            <ul className="space-y-2 text-sm text-slate-600">
              <li>
                <a href="/#marche" className="transition hover:text-[#10294B] hover:underline">
                  Comment ça marche
                </a>
              </li>
              <li>
                <a href="/#abonnements" className="transition hover:text-[#10294B] hover:underline">
                  Abonnements
                </a>
              </li>
              <li>
                <a href="/#offres" className="transition hover:text-[#10294B] hover:underline">
                  Les tarifs
                </a>
              </li>
              <li>
                <a href="/#collecte" className="transition hover:text-[#10294B] hover:underline">
                  Collecte sans abonnement
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[#CE2029]">
              Services
            </h3>
            <ul className="space-y-2 text-sm text-slate-600">
              <li>
                <a href="/#kit" className="transition hover:text-[#10294B] hover:underline">
                  Kit du repasseur
                </a>
              </li>
              <li>
                <Link
                  href="/preparation"
                  className="transition hover:text-[#10294B] hover:underline"
                >
                  Bien préparer sa collecte
                </Link>
              </li>
              <li>
                <a href="/#choisir" className="transition hover:text-[#10294B] hover:underline">
                  Pourquoi le Repasseur
                </a>
              </li>
              <li>
                <a href="/#telecharger" className="transition hover:text-[#10294B] hover:underline">
                  Application mobile
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[#CE2029]">
              Compte &amp; aide
            </h3>
            <ul className="space-y-2 text-sm text-slate-600">
              <li>
                <Link href="/connexion" className="transition hover:text-[#10294B] hover:underline">
                  Connexion
                </Link>
              </li>
              <li>
                <Link href="/inscription" className="transition hover:text-[#10294B] hover:underline">
                  Inscription
                </Link>
              </li>
              <li>
                <Link href="/compte" className="transition hover:text-[#10294B] hover:underline">
                  Mon espace
                </Link>
              </li>
              <li>
                <a href={LEGACY("/faq.html")} className="transition hover:text-[#10294B] hover:underline">
                  FAQ
                </a>
              </li>
              <li>
                <Link href="/contact" className="transition hover:text-[#10294B] hover:underline">
                  Contact
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[#CE2029]">
              Légal
            </h3>
            <ul className="space-y-2 text-sm text-slate-600">
              <li>
                <Link href="/cgu" className="transition hover:text-[#10294B] hover:underline">
                  Conditions d&apos;utilisation
                </Link>
              </li>
              <li>
                <Link href="/cgv" className="transition hover:text-[#10294B] hover:underline">
                  Conditions générales de vente
                </Link>
              </li>
              <li>
                <Link href="/confidentialite" className="transition hover:text-[#10294B] hover:underline">
                  Confidentialité
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <p className="mt-12 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Le Repasseur — le-repasseur.fr
        </p>
      </div>
    </footer>
  );
}
