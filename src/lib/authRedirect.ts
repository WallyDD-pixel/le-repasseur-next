import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase";

/** État d’accès dérivé du profil Firestore + liste des abonnements. */
export type UserAccessResult = {
  userExists: boolean;
  role?: string;
  isAdmin: boolean;
  isSubscribedClient: boolean;
  isPendingSignup: boolean;
  /** Inscrit hors secteur : compte créé, en attente d’ouverture locale. */
  isWaitingSector: boolean;
  unknownRoleError?: string;
};

export async function getUserAccess(uid: string): Promise<UserAccessResult> {
  const db = getFirebaseFirestore();
  const [abonnSnap, userSnap] = await Promise.all([
    getDocs(collection(db, "abonnements")),
    getDoc(doc(db, "users", uid)),
  ]);

  const authorizedRoles: string[] = [];
  abonnSnap.forEach((d) => {
    const n = d.data().nom;
    if (typeof n === "string" && n) authorizedRoles.push(n);
  });

  if (!userSnap.exists()) {
    return {
      userExists: false,
      isAdmin: false,
      isSubscribedClient: false,
      isPendingSignup: false,
      isWaitingSector: false,
    };
  }

  const role = userSnap.data().role as string | undefined;

  if (role === "attente_secteur") {
    return {
      userExists: true,
      role,
      isAdmin: false,
      isSubscribedClient: false,
      isPendingSignup: false,
      isWaitingSector: true,
    };
  }

  if (role === "admin") {
    return {
      userExists: true,
      role,
      isAdmin: true,
      isSubscribedClient: false,
      isPendingSignup: false,
      isWaitingSector: false,
    };
  }
  if (role === "aucun") {
    return {
      userExists: true,
      role,
      isAdmin: false,
      isSubscribedClient: false,
      isPendingSignup: true,
      isWaitingSector: false,
    };
  }
  if (role && authorizedRoles.includes(role) && role !== "aucun") {
    return {
      userExists: true,
      role,
      isAdmin: false,
      isSubscribedClient: true,
      isPendingSignup: false,
      isWaitingSector: false,
    };
  }

  return {
    userExists: true,
    role,
    isAdmin: false,
    isSubscribedClient: false,
    isPendingSignup: false,
    isWaitingSector: false,
    unknownRoleError: `Rôle non reconnu : ${role ?? "—"}`,
  };
}

/** Détermine la redirection après connexion (même logique que l’ancien site, routes Next.js). */
export async function resolvePostLoginHref(uid: string): Promise<{
  href: string;
  external?: boolean;
  error?: string;
}> {
  const access = await getUserAccess(uid);

  if (!access.userExists) {
    return { href: "/compte", error: "Profil introuvable dans la base." };
  }
  if (access.isAdmin) {
    return { href: "/admin" };
  }

  return {
    href: "/espace-client",
    error: access.unknownRoleError,
  };
}
