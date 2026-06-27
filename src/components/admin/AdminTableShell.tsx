import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Pied de tableau (pagination, etc.) — hors zone scrollable */
  footer?: ReactNode;
  className?: string;
};

/**
 * Conteneur tableau admin : scroll horizontal si les colonnes dépassent la largeur.
 */
export function AdminTableShell({ children, footer, className = "" }: Props) {
  return (
    <div
      className={`min-w-0 w-full max-w-full rounded-2xl border border-slate-200/90 bg-white shadow-sm ${className}`}
    >
      <div className="min-w-0 w-full max-w-full overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
        {children}
      </div>
      {footer}
    </div>
  );
}
