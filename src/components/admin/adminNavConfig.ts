export type AdminNavItem = {
  label: string;
  href: string;
  external?: boolean;
};

export type AdminNavSection = {
  title: string;
  items: AdminNavItem[];
};

/** Navigation alignée sur l’ancienne console (sections migrées en Next). */
export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  {
    title: "Abonnements",
    items: [
      { label: "Afficher les abonnements", href: "/admin/abonnements", external: false },
      { label: "Ajouter un abonnement", href: "/admin/abonnements/nouveau", external: false },
    ],
  },
  {
    title: "Produits",
    items: [
      { label: "Afficher les produits", href: "/admin/produits", external: false },
      { label: "Ajouter un produit", href: "/admin/produits/nouveau", external: false },
    ],
  },
  {
    title: "Gestion",
    items: [
      { label: "Disponibilités", href: "/admin/disponibilites", external: false },
      { label: "Activité", href: "/admin/activite", external: false },
    ],
  },
  {
    title: "Utilisateurs",
    items: [{ label: "Liste des utilisateurs", href: "/admin/utilisateurs", external: false }],
  },
  {
    title: "Réservations",
    items: [
      {
        label: "Demandes de réservation",
        href: "/admin/reservations",
        external: false,
      },
    ],
  },
  {
    title: "Messages",
    items: [{ label: "Messages", href: "/admin/messages", external: false }],
  },
  {
    title: "Marketing",
    items: [{ label: "Codes partenaires", href: "/admin/partenaires", external: false }],
  },
  {
    title: "Service client",
    items: [
      { label: "Gestion des résiliations", href: "/admin/resiliations", external: false },
    ],
  },
  {
    title: "Emails",
    items: [{ label: "Gestion des emails", href: "/admin/emails", external: false }],
  },
  {
    title: "Configuration",
    items: [
      {
        label: "Configuration Stripe",
        href: "/admin/stripe",
        external: false,
      },
    ],
  },
];
