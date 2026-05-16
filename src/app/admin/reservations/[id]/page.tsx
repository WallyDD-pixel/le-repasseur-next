"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  RESERVATION_ETAT_DEFAULT,
  RESERVATION_ETAT_OPTIONS,
  RESERVATIONS_COLLECTION,
  TAKE_CHARGE_ETAT,
  deleteReservationDoc,
  formatHeureReservation,
  formatReservationCreneau,
  getReservationEtapeIndex,
  loadReservationById,
  reservationEtatBadgeClass,
  reservationNeedsTakeCharge,
  setReservationEtat,
  type ReservationAdminRow,
} from "@/lib/reservationsAdmin";
import { getFirebaseFirestore } from "@/lib/firebase";
import { firebaseMessage } from "@/lib/firebaseError";
import { Label, PrimaryButton } from "@/components/ui/FormField";

function ReservationEtapesProgress({ etat }: { etat: string }) {
  const current = getReservationEtapeIndex(etat);

  return (
    <ol className="mb-6 space-y-0" aria-label="Étapes de la réservation">
      {RESERVATION_ETAT_OPTIONS.map((label, index) => {
        const done = current >= 0 && index < current;
        const active = current === index;
        const upcoming = current >= 0 ? index > current : false;

        return (
          <li key={label} className="flex gap-3">
            <div className="flex flex-col items-center" aria-hidden>
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-2 ${
                  active
                    ? "bg-[#10294B] text-white ring-[#10294B]"
                    : done
                      ? "bg-emerald-600 text-white ring-emerald-600"
                      : "bg-white text-slate-400 ring-slate-200"
                }`}
              >
                {done ? "✓" : index + 1}
              </span>
              {index < RESERVATION_ETAT_OPTIONS.length - 1 ? (
                <span
                  className={`my-1 w-0.5 flex-1 min-h-[1.25rem] ${
                    done ? "bg-emerald-400" : "bg-slate-200"
                  }`}
                />
              ) : null}
            </div>
            <div className={`pb-4 ${upcoming ? "opacity-55" : ""}`}>
              <p
                className={`text-sm font-semibold ${
                  active
                    ? "text-[#10294B]"
                    : done
                      ? "text-emerald-800"
                      : "text-slate-600"
                }`}
              >
                {label}
              </p>
              {active ? (
                <p className="mt-0.5 text-xs text-[#CE2029]">Étape en cours</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 border-b border-slate-100 py-3 sm:grid-cols-[minmax(0,200px)_1fr] sm:gap-4">
      <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="text-sm text-slate-800">{children}</dd>
    </div>
  );
}

function AdminReservationDetailContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoPrendre = searchParams.get("prendre") === "1";

  const raw = params.id;
  const id =
    typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] ?? "" : "";

  const [row, setRow] = useState<ReservationAdminRow | null>(null);
  const [etat, setEtat] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const autoPrendreDone = useRef(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const loaded = await loadReservationById(getFirebaseFirestore(), id);
      if (!loaded) {
        setRow(null);
        setError("Demande introuvable.");
        return;
      }
      setRow(loaded);
      setEtat(
        loaded.etat === "—"
          ? RESERVATION_ETAT_DEFAULT
          : loaded.etat
      );
    } catch (err) {
      setError(firebaseMessage(err));
      setRow(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!row || !autoPrendre || autoPrendreDone.current) return;
    if (!reservationNeedsTakeCharge(row.etat)) {
      autoPrendreDone.current = true;
      return;
    }
    autoPrendreDone.current = true;
    void (async () => {
      setSaving(true);
      setError(null);
      try {
        await setReservationEtat(getFirebaseFirestore(), row, TAKE_CHARGE_ETAT);
        setEtat(TAKE_CHARGE_ETAT);
        setRow((prev) =>
          prev ? { ...prev, etat: TAKE_CHARGE_ETAT } : prev
        );
        setInfo(`Demande passée en « ${TAKE_CHARGE_ETAT} ».`);
      } catch (err) {
        setError(`Prise en charge impossible — ${firebaseMessage(err)}`);
      } finally {
        setSaving(false);
      }
    })();
  }, [row, autoPrendre]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!row) return;
    const next = etat.trim();
    if (!next) {
      setError("Choisissez un état.");
      return;
    }
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      await setReservationEtat(getFirebaseFirestore(), row, next);
      setRow((prev) => (prev ? { ...prev, etat: next } : prev));
      setInfo("Réservation mise à jour.");
    } catch (err) {
      setError(`Enregistrement impossible — ${firebaseMessage(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!row) return;
    if (
      !window.confirm(
        `Supprimer la demande de « ${row.prenom} ${row.nom} » ? Cette action est irréversible.`
      )
    ) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await deleteReservationDoc(getFirebaseFirestore(), row.id);
      router.push("/admin/reservations");
    } catch (err) {
      setError(`Suppression impossible — ${firebaseMessage(err)}`);
    } finally {
      setDeleting(false);
    }
  }

  if (!id) {
    return <p className="text-red-700">Identifiant invalide.</p>;
  }

  if (loading) {
    return <p className="py-16 text-center text-slate-600">Chargement…</p>;
  }

  if (error && !row) {
    return (
      <div className="mx-auto max-w-lg">
        <p className="text-red-700">{error}</p>
        <Link
          href="/admin/reservations"
          className="mt-4 inline-block text-sm font-semibold text-[#10294B] hover:underline"
        >
          ← Demandes de réservation
        </Link>
      </div>
    );
  }

  if (!row) return null;

  const etatOptions = RESERVATION_ETAT_OPTIONS.includes(
    etat as (typeof RESERVATION_ETAT_OPTIONS)[number]
  )
    ? [...RESERVATION_ETAT_OPTIONS]
    : etat && etat !== "—"
      ? [etat, ...RESERVATION_ETAT_OPTIONS]
      : [...RESERVATION_ETAT_OPTIONS];

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/admin/reservations"
        className="text-sm font-semibold text-[#10294B] hover:underline"
      >
        ← Demandes de réservation
      </Link>

      <header className="mt-4 mb-8">
        <h1 className="font-lobster text-3xl text-[#10294B] sm:text-4xl">
          Gérer la réservation
        </h1>
        <p className="mt-2 text-slate-600">
          {row.prenom} {row.nom}
          <span className="mx-2 text-slate-300">·</span>
          <span className="font-mono text-xs text-slate-500">{row.id}</span>
        </p>
        <p className="mt-2">
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${reservationEtatBadgeClass(row.etat)}`}
          >
            {row.etat}
          </span>
        </p>
      </header>

      {error ? (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {info ? (
        <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {info}
        </p>
      ) : null}

      <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-[#CE2029]">
          Détails
        </h2>
        <dl>
          <DetailRow label="Heure demande">
            {formatHeureReservation(row.heureReservation)}
          </DetailRow>
          <DetailRow label="Collecte">
            {formatReservationCreneau(
              row.dateReservation,
              row.dateReservationDisplay
            )}
          </DetailRow>
          <DetailRow label="Retour">
            {formatReservationCreneau(row.dateRetour, row.dateRetourDisplay)}
          </DetailRow>
          <DetailRow label="Poids">{row.kgDisplay}</DetailRow>
          <DetailRow label="Rôle / formule">{row.role}</DetailRow>
          <DetailRow label="Téléphone">{row.telephone}</DetailRow>
          <DetailRow label="N° commande">{row.numeroCommande}</DetailRow>
          <DetailRow label="Activité">{row.activite}</DetailRow>
          <DetailRow label="Code postal">{row.codePostal}</DetailRow>
          <DetailRow label="Adresse collecte">{row.adresseCollecte}</DetailRow>
          <DetailRow label="Adresse retour">{row.adresseRetour}</DetailRow>
          {row.userId ? (
            <DetailRow label="Utilisateur">
              <Link
                href={`/admin/utilisateurs/${encodeURIComponent(row.userId)}`}
                className="font-semibold text-[#10294B] underline decoration-[#CE2029]/30 hover:text-[#CE2029]"
              >
                Voir le profil client
              </Link>
            </DetailRow>
          ) : null}
        </dl>
      </section>

      <form
        onSubmit={(e) => void onSave(e)}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-[#CE2029]">
          État de la réservation
        </h2>
        <ReservationEtapesProgress etat={etat || row.etat} />
        <p className="mb-4 text-sm text-slate-600">
          Collection{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
            {RESERVATIONS_COLLECTION}
          </code>
          , champ{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
            {row.etatFieldName}
          </code>
          .
        </p>

        <div className="space-y-4">
          <div>
            <Label htmlFor="reservation-etat">État</Label>
            <select
              id="reservation-etat"
              value={etat}
              onChange={(e) => setEtat(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-[#10294B] shadow-sm outline-none focus:border-[#10294B]/35 focus:ring-4 focus:ring-[#CE2029]/15"
            >
              {etatOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <PrimaryButton type="submit" loading={saving}>
              Enregistrer
            </PrimaryButton>
            <button
              type="button"
              disabled={saving || deleting}
              onClick={() => void onDelete()}
              className="inline-flex min-h-[46px] items-center rounded-xl border border-[#CE2029]/35 bg-white px-5 py-2.5 text-sm font-bold text-[#CE2029] transition hover:bg-[#CE2029]/5 disabled:opacity-50"
            >
              {deleting ? "Suppression…" : "Supprimer la demande"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function AdminReservationDetailPage() {
  return (
    <Suspense
      fallback={<p className="py-16 text-center text-slate-600">Chargement…</p>}
    >
      <AdminReservationDetailContent />
    </Suspense>
  );
}
