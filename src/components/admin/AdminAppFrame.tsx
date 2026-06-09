"use client";

import { useState } from "react";
import { AdminAuthGate } from "@/components/admin/AdminAuthGate";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export function AdminAppFrame({ children }: { children: React.ReactNode }) {
  const [mobileNav, setMobileNav] = useState(false);

  return (
    <AdminAuthGate>
      <div className="flex min-h-screen min-w-0 bg-[#eef1f6]">
        <AdminSidebar
          mobileOpen={mobileNav}
          onCloseMobile={() => setMobileNav(false)}
        />

        <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:min-h-0">
          <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
            <button
              type="button"
              onClick={() => setMobileNav(true)}
              className="rounded-lg border border-slate-200 bg-white p-2 text-[#10294B] shadow-sm"
              aria-expanded={mobileNav}
              aria-controls="admin-sidebar"
            >
              <span className="sr-only">Ouvrir le menu</span>
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <span className="font-lobster text-lg text-[#10294B]">
              Administration
            </span>
          </header>

          <main className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:py-10">
            {children}
          </main>
        </div>
      </div>
    </AdminAuthGate>
  );
}
