"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { EspaceClientAccountFooter } from "@/components/espace-client/EspaceClientAccountFooter";
import { ClientProductCatalog } from "@/components/espace-client/ClientProductCatalog";
import { ClientTransactionsHistory } from "@/components/espace-client/ClientTransactionsHistory";
import { ClientReservationsTable } from "@/components/espace-client/ClientReservationsTable";
import { EspaceClientStatusPanel } from "@/components/espace-client/EspaceClientStatusPanel";
import { PartnerCodeForm } from "@/components/espace-client/PartnerCodeForm";
import { getFirebaseAuth, getFirebaseFirestore } from "@/lib/firebase";
import { getUserAccess, type UserAccessResult } from "@/lib/authRedirect";
import { siteAsset } from "@/lib/assetBase";
import {
  loadUserReservationRows,
  type ReservationAdminRow,
} from "@/lib/reservationsAdmin";
import { firebaseMessage } from "@/lib/firebaseError";
import { PageShell } from "@/components/shell/PageShell";
import { BackLink } from "@/components/ui/BackLink";
import { Button, ButtonLink } from "@/components/ui/Button";

function str(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return String(v);
}

function pickFirst(data: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (k in data && data[k] != null) return data[k];
  }
  return undefined;
}

/** Quota kg restant — Firestore : champ `collectes` (pas confondre avec les collectes restantes). */
function normalizeKgDisplay(data: Record<string, unknown>): string {
  const raw = pickFirst(data, [
    "collectes",
    "poidsRestant",
    "kgRestant",
    "quotaKg",
    "kg",
    "poids",
    "weight",
  ]);
  if (typeof raw === "number" && Number.isFinite(raw)) return `${raw} kg`;
  if (typeof raw === "string" && raw.trim()) {
    const t = raw.trim();
    return t.toLowerCase().includes("kg") ? t : `${t} kg`;
  }
  return "0 kg";
}

/** Nombre de collectes restantes — Firestore : champ `reservations`. */
function normalizeReservationsDisplay(data: Record<string, unknown>): string {
  const raw = pickFirst(data, [
    "reservations",
    "reservation",
    "reservationsRestantes",
    "nbReservations",
    "nombreReservations",
    "remainingPickups",
  ]);
  if (typeof raw === "number" && Number.isFinite(raw)) return String(Math.floor(raw));
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return "0";
}

type MyTxRow = {
  id: string;
  date: Date | null;
  type: string;
  titre: string;
  montantDisplay: string;
};

function toDate(raw: unknown): Date | null {
  if (raw instanceof Timestamp) return raw.toDate();
  if (
    raw &&
    typeof raw === "object" &&
    "toDate" in raw &&
    typeof (raw as { toDate: () => Date }).toDate === "function"
  ) {
    try {
      return (raw as { toDate: () => Date }).toDate();
    } catch {
      return null;
    }
  }
  if (typeof raw === "string" || typeof raw === "number") {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function formatTxDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

function formatTxAmount(raw: unknown): string {
  if (typeof raw === "number" && Number.isFinite(raw)) return `${raw} €`;
  if (typeof raw === "string" && raw.trim()) {
    const t = raw.trim();
    return t.includes("€") ? t : `${t} €`;
  }
  return "—";
}

function labelTxType(raw: unknown): string {
  const t = str(raw).toLowerCase();
  if (!t) return "Paiement";
  if (t.includes("renouvel")) return "Renouvellement";
  if (t.includes("abonn")) return "Abonnement";
  if (t.includes("paiement")) return "Paiement";
  return str(raw) || "Paiement";
}

function AppStoreBadgeRow() {
  return (
    <div className="rounded-2xl border border-slate-200/50 bg-white/70 px-5 py-5 shadow-sm backdrop-blur-sm sm:px-6 lg:inline-block lg:max-w-none lg:px-8 lg:py-6">
      <p className="mb-1 text-center text-sm font-bold text-[#10294B] lg:text-left">
        Accéder à l&apos;application
      </p>
      <p className="mb-4 text-center text-xs text-slate-500 lg:text-left">
        Réservez vos créneaux de collecte en quelques clics
      </p>
      <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-10 lg:justify-start">
        <a
          href="https://play.google.com/store/apps/details?id=com.repasseur.repasseur&gl=FR"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block leading-none transition hover:opacity-90"
        >
          <Image
            src={siteAsset("/assets/imgg/pngegg.png")}
            alt="Télécharger sur Google Play"
            width={150}
            height={50}
            className="h-auto w-[150px]"
            unoptimized
          />
        </a>
        <a
          href="https://apps.apple.com/us/app/le-repasseur/id6670428906"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block leading-none transition hover:opacity-90"
        >
          <Image
            src={siteAsset("/assets/imgg/pngegg (1).png")}
            alt="Télécharger sur l'App Store"
            width={150}
            height={50}
            className="h-auto w-[150px]"
            unoptimized
          />
        </a>
      </div>
    </div>
  );
}

function formatFirstName(
  prenom: string | undefined,
  email: string | null
): string {
  const p = prenom?.trim();
  if (p) {
    return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
  }
  if (email) {
    const local = email.split("@")[0] ?? "vous";
    return local.charAt(0).toUpperCase() + local.slice(1);
  }
  return "vous";
}

function EspaceClientPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [prenom, setPrenom] = useState<string | undefined>();
  const [access, setAccess] = useState<UserAccessResult | null>(null);
  const [checkoutInfo, setCheckoutInfo] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [collectesDisplay, setCollectesDisplay] = useState("0");
  const [poidsDisplay, setPoidsDisplay] = useState("0 kg");
  const [txRows, setTxRows] = useState<MyTxRow[]>([]);
  const [reservationRows, setReservationRows] = useState<ReservationAdminRow[]>(
    []
  );
  const [reservationsLoading, setReservationsLoading] = useState(true);
  const [reservationsError, setReservationsError] = useState<string | null>(
    null
  );
  useEffect(() => {
    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      setEmail(u.email);
      const db = getFirebaseFirestore();
      const [a, userSnap] = await Promise.all([
        getUserAccess(u.uid),
        getDoc(doc(db, "users", u.uid)),
      ]);
      let userData: Record<string, unknown> | undefined;
      if (userSnap.exists()) {
        userData = userSnap.data() as Record<string, unknown>;
        const pr = userData.prenom;
        if (typeof pr === "string") setPrenom(pr);
        setCollectesDisplay(normalizeReservationsDisplay(userData));
        setPoidsDisplay(normalizeKgDisplay(userData));
      } else {
        setCollectesDisplay("—");
        setPoidsDisplay("—");
      }
      if (a.isAdmin) {
        router.replace("/admin");
        return;
      }
      setReservationsLoading(true);
      setReservationsError(null);
      try {
        const reservations = await loadUserReservationRows(db, u.uid);
        setReservationRows(reservations);
      } catch (err) {
        setReservationRows([]);
        setReservationsError(
          `Impossible de charger vos demandes — ${firebaseMessage(err)}.`
        );
      } finally {
        setReservationsLoading(false);
      }

      try {
        const txSnap = await getDocs(
          query(collection(db, "transactions"), where("userId", "==", u.uid))
        );
        const rows: MyTxRow[] = [];
        txSnap.forEach((d) => {
          const data = d.data() as Record<string, unknown>;
          rows.push({
            id: d.id,
            date: toDate(data.transactionDate ?? data.date ?? data.createdAt),
            type: labelTxType(data.type),
            titre: str(data.titre) || str(data.role) || "Paiement",
            montantDisplay: formatTxAmount(data.montant ?? data.amount ?? data.prix),
          });
        });
        rows.sort(
          (x, y) => (y.date?.getTime() ?? 0) - (x.date?.getTime() ?? 0)
        );
        setTxRows(rows);
      } catch {
        setTxRows([]);
      }
      setAccess(a);
      setReady(true);
    });
  }, [router]);

  useEffect(() => {
    if (!ready || searchParams.get("welcome") !== "1") return;
    const el = document.getElementById("choose-abo");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [ready, searchParams]);

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    const sessionId = searchParams.get("session_id");
    const plan = searchParams.get("plan");
    if (checkout !== "success" || !sessionId) return;
    if (!ready) return;

    const run = async () => {
      setCheckoutError(null);
      setCheckoutInfo("Paiement validé. Synchronisation de votre abonnement…");
      const u = getFirebaseAuth().currentUser;
      if (!u) {
        setCheckoutError("Session expirée. Reconnectez-vous puis réessayez.");
        setCheckoutInfo(null);
        return;
      }
      let idToken = "";
      try {
        idToken = await u.getIdToken();
      } catch {
        setCheckoutError("Impossible de vérifier la session. Rechargez la page.");
        setCheckoutInfo(null);
        return;
      }
      const res = await fetch("/api/checkout/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, idToken }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        planId?: string | null;
        subscriptionActivated?: boolean;
      };
      if (!res.ok || !data.ok) {
        setCheckoutError(
          typeof data.error === "string"
            ? data.error
            : "Confirmation du paiement impossible."
        );
        setCheckoutInfo(null);
        return;
      }
      const label = data.planId || plan || "votre achat";
      setCheckoutInfo(
        data.subscriptionActivated
          ? `Merci. Votre abonnement « ${label} » est activé.`
          : `Merci. Votre paiement pour « ${label} » est confirmé.`
      );

      // Recharge l'accès (rôle / abonnement) après mise à jour serveur.
      try {
        const a = await getUserAccess(u.uid);
        setAccess(a);
        const snap = await getDoc(doc(getFirebaseFirestore(), "users", u.uid));
        if (snap.exists()) {
          const userData = snap.data() as Record<string, unknown>;
          setCollectesDisplay(normalizeReservationsDisplay(userData));
          setPoidsDisplay(normalizeKgDisplay(userData));
        }
        const txSnap = await getDocs(
          query(collection(getFirebaseFirestore(), "transactions"), where("userId", "==", u.uid))
        );
        const rows: MyTxRow[] = [];
        txSnap.forEach((d) => {
          const data = d.data() as Record<string, unknown>;
          rows.push({
            id: d.id,
            date: toDate(data.transactionDate ?? data.date ?? data.createdAt),
            type: labelTxType(data.type),
            titre: str(data.titre) || str(data.role) || "Paiement",
            montantDisplay: formatTxAmount(data.montant ?? data.amount ?? data.prix),
          });
        });
        rows.sort(
          (x, y) => (y.date?.getTime() ?? 0) - (x.date?.getTime() ?? 0)
        );
        setTxRows(rows);
      } catch {
        /* ignore */
      }
    };

    void run();
  }, [searchParams, ready]);

  if (!ready || !access) {
    return (
      <PageShell title="Mon espace" subtitle="Chargement…">
        <p className="py-10 text-center text-slate-500">Patientez…</p>
      </PageShell>
    );
  }

  const subscribed = access.isSubscribedClient;
  const firstName = formatFirstName(prenom, email);
  const subscriptionDisplay = subscribed
    ? (access.role ?? "Abonné").toUpperCase()
    : "AUCUN";

  return (
    <PageShell
      title="Espace client"
      maxWidth="xl"
      showShellHeading={false}
      contentVariant="flush"
    >
      <div className="space-y-8 lg:space-y-10">
        <h1 className="sr-only">Espace client Le Repasseur</h1>

        <BackLink href="/" label="Retour à l’accueil" />

        {checkoutInfo ? (
          <p
            className="rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-3 text-center text-sm text-emerald-900"
            role="status"
          >
            {checkoutInfo}
          </p>
        ) : null}
        {checkoutError ? (
          <p className="text-center text-sm text-red-600" role="alert">
            {checkoutError}
          </p>
        ) : null}

        <EspaceClientStatusPanel
          firstName={firstName}
          subscriptionDisplay={subscriptionDisplay}
          collectesDisplay={collectesDisplay}
          poidsDisplay={poidsDisplay}
          subscribedHint={subscribed}
        />

        <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-start lg:gap-12 xl:gap-16">
          <AppStoreBadgeRow />
          <PartnerCodeForm />
        </div>

        <ClientReservationsTable
          rows={reservationRows}
          loading={reservationsLoading}
          error={reservationsError}
        />

        <ClientProductCatalog
          subscribed={subscribed}
          currentRole={access.role}
          beforeSubscriptions={
            <>
              <ClientTransactionsHistory
                rows={txRows}
                formatDate={formatTxDate}
              />
              {subscribed ? (
                <div className="flex gap-4 rounded-2xl border-l-4 border-[#CE2029] bg-gradient-to-r from-[#CE2029]/[0.08] to-transparent px-5 py-4 lg:max-w-4xl">
                  <p className="text-sm leading-relaxed text-[#10294B]">
                    <span className="font-bold text-[#CE2029]">Abonné :</span>{" "}
                    vos collectes et votre quota se suivent dans
                    l&apos;application. Ci-dessous : packs ponctuels ou
                    changement de formule.
                  </p>
                </div>
              ) : null}
            </>
          }
        />

        <EspaceClientAccountFooter subscribed={subscribed} />

        <div className="flex flex-col items-stretch gap-3 border-t border-slate-200/50 pt-8 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-3 lg:pt-10">
          <ButtonLink href="/" variant="ghost" size="sm" className="sm:!w-auto">
            Accueil du site
          </ButtonLink>
          <ButtonLink href="/compte" variant="ghost" size="sm" className="sm:!w-auto">
            Mon compte
          </ButtonLink>
          <ButtonLink href="/contact" variant="ghost" size="sm" className="sm:!w-auto">
            Contact
          </ButtonLink>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="lg"
          fullWidth
          className="lg:mx-auto lg:max-w-xs"
          onClick={() => signOut(getFirebaseAuth())}
        >
          Se déconnecter
        </Button>
      </div>
    </PageShell>
  );
}

export default function EspaceClientPage() {
  return (
    <Suspense
      fallback={
        <PageShell title="Mon espace" subtitle="Chargement…">
          <p className="py-10 text-center text-slate-500">Patientez…</p>
        </PageShell>
      }
    >
      <EspaceClientPageContent />
    </Suspense>
  );
}
