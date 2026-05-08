import type { ReactNode } from "react";

type MaxWidth = "sm" | "md" | "lg" | "xl";

const maxW: Record<MaxWidth, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-3xl",
  xl: "max-w-7xl",
};

export function PageShell({
  title,
  subtitle,
  children,
  maxWidth = "md",
  showShellHeading = true,
  contentVariant = "card",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  maxWidth?: MaxWidth;
  /** Si false, seul le bloc carte blanche + children (titres custom dans le contenu). */
  showShellHeading?: boolean;
  /**
   * `flush` : sur lg+ pas de cadre blanc arrondi (contenu dans le fond de page).
   * Sur mobile, léger fond pour la lisibilité.
   */
  contentVariant?: "card" | "flush";
}) {
  return (
    <div className="relative min-h-[calc(100vh-12rem)] overflow-hidden bg-[#f4f6f9] pb-20 pt-24 sm:pt-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_-10%,rgba(206,32,41,0.12),transparent_55%)]" />
      <div className="pointer-events-none absolute -right-24 top-40 h-64 w-64 rounded-full bg-[#10294B]/[0.04] blur-3xl" />
      <div className="pointer-events-none absolute -left-24 bottom-20 h-56 w-56 rounded-full bg-[#CE2029]/[0.06] blur-3xl" />

      <div className={`relative mx-auto w-full px-4 sm:px-6 ${maxW[maxWidth]}`}>
        {showShellHeading ? (
          <header className="mb-8 text-center">
            <h1 className="font-lobster text-4xl tracking-tight text-[#10294B] sm:text-5xl">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-3 text-base leading-relaxed text-slate-600 sm:text-lg">
                {subtitle}
              </p>
            ) : null}
          </header>
        ) : null}

        <div
          className={
            contentVariant === "flush"
              ? "rounded-2xl border border-slate-200/60 bg-white/90 p-5 shadow-sm backdrop-blur-sm sm:p-6 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none"
              : "rounded-[1.75rem] border border-white/70 bg-white/90 p-6 shadow-[0_12px_48px_-12px_rgba(16,41,75,0.2)] backdrop-blur-md sm:p-10"
          }
        >
          {children}
        </div>
      </div>
    </div>
  );
}
