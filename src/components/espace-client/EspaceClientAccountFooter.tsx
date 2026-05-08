import Link from "next/link";

/**
 * Actions compte (aligné sur l’ancienne app) : modifier, supprimer, résilier.
 * Suppression / résiliation passent par le contact jusqu’à branchement Stripe / admin.
 */
export function EspaceClientAccountFooter() {
  return (
    <nav
      className="border-t-2 border-[#10294B] pt-6"
      aria-label="Gestion du compte et de l’abonnement"
    >
      <ul className="flex flex-col gap-3 pl-1 sm:pl-2">
        <li>
          <Link
            href="/compte"
            className="inline-block text-sm font-bold text-[#10294B] transition hover:underline sm:text-base"
          >
            Modifier mon compte
          </Link>
        </li>
        <li>
          <Link
            href="/contact?demande=suppression-compte"
            className="inline-block text-sm font-bold text-[#10294B] transition hover:underline sm:text-base"
          >
            Supprimer mon compte
          </Link>
        </li>
        <li>
          <Link
            href="/contact?demande=resiliation-abonnement"
            className="inline-block text-sm font-bold text-[#10294B] transition hover:underline sm:text-base"
          >
            Résilier mon abonnement
          </Link>
        </li>
      </ul>
    </nav>
  );
}
