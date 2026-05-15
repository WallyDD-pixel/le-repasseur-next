import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

/** Lien vers la page dédiée `/communes` (nouvel onglet pour ne pas perdre le formulaire). */
export function CommunesCouvertesLink({
  children,
  className = "font-semibold text-[#CE2029] hover:underline",
}: Props) {
  return (
    <Link
      href="/communes"
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
    </Link>
  );
}
