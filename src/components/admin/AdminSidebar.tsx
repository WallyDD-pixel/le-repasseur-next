"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { ADMIN_NAV_SECTIONS } from "@/components/admin/adminNavConfig";

function internalNavActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  /* La liste /admin/abonnements ne doit pas être « active » sur /admin/abonnements/nouveau
     (sinon prefix match …/abonnements/ inclut la page création). */
  if (href === "/admin/abonnements") {
    if (pathname === "/admin/abonnements") return true;
    if (pathname.startsWith("/admin/abonnements/")) {
      return !pathname.startsWith("/admin/abonnements/nouveau");
    }
    return false;
  }
  if (href === "/admin/produits") {
    if (pathname === "/admin/produits") return true;
    if (pathname.startsWith("/admin/produits/")) {
      return !pathname.startsWith("/admin/produits/nouveau");
    }
    return false;
  }
  if (href === "/admin/partenaires") {
    return pathname.startsWith("/admin/partenaires");
  }
  if (href === "/admin/messages") {
    return pathname === "/admin/messages" || pathname.startsWith("/admin/messages/");
  }
  if (href === "/admin/resiliations") {
    return pathname.startsWith("/admin/resiliations");
  }
  if (href === "/admin/emails") {
    return pathname.startsWith("/admin/emails");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  href,
  external,
  children,
  active,
  onPick,
}: {
  href: string;
  external?: boolean;
  children: React.ReactNode;
  active: boolean;
  onPick?: () => void;
}) {
  const cls = `block rounded-lg px-3 py-2 text-sm transition ${
    active
      ? "bg-white/15 font-semibold text-white"
      : "text-slate-300 hover:bg-white/10 hover:text-white"
  }`;

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={cls} onClick={() => onPick?.()}>
      {children}
    </Link>
  );
}

export function AdminSidebar({
  mobileOpen,
  onCloseMobile,
}: {
  mobileOpen: boolean;
  onCloseMobile?: () => void;
}) {
  const pathname = usePathname();
  const close = () => onCloseMobile?.();

  return (
    <>
      <button
        type="button"
        aria-label="Fermer le menu"
        className={`fixed inset-0 z-40 bg-black/50 transition lg:hidden ${
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={close}
      />

      <aside
        id="admin-sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-white/10 bg-[#152642] shadow-xl transition-transform duration-200 lg:static lg:translate-x-0 lg:shadow-none ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="border-b border-white/10 px-5 py-6">
          <p className="font-lobster text-xl text-white">Le Repasseur</p>
          <p className="mt-1 text-xs font-medium uppercase tracking-wider text-slate-400">
            Administration
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-4">
            <NavLink
              href="/admin"
              active={internalNavActive(pathname, "/admin")}
              onPick={close}
            >
              Tableau de bord
            </NavLink>
          </div>

          {ADMIN_NAV_SECTIONS.map((section) => (
            <div key={section.title} className="mb-5">
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                {section.title}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active =
                    !item.external &&
                    internalNavActive(pathname, item.href);
                  return (
                    <li key={`${section.title}-${item.label}`}>
                      <NavLink
                        href={item.href}
                        external={item.external}
                        active={active}
                        onPick={item.external ? undefined : close}
                      >
                        {item.label}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <Link
            href="/"
            onClick={close}
            className="mb-2 block rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            Retour au site
          </Link>
          <button
            type="button"
            onClick={() => {
              close();
              signOut(getFirebaseAuth());
            }}
            className="w-full rounded-lg bg-[#CE2029] py-2.5 text-sm font-bold text-white transition hover:bg-[#b91b24]"
          >
            Déconnexion
          </button>
        </div>
      </aside>
    </>
  );
}
