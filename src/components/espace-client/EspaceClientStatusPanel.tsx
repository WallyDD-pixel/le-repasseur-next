"use client";

function IconTruck({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 3.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"
      />
    </svg>
  );
}

function IconScale({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
      />
    </svg>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex min-w-[160px] max-w-[220px] flex-1 items-center gap-4 rounded-2xl border border-slate-200/60 bg-white/90 px-4 py-4 shadow-sm ring-1 ring-white/60 sm:min-w-[180px] sm:px-5">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#CE2029]/15 to-[#CE2029]/5 text-[#CE2029]">
        {icon}
      </div>
      <div className="min-w-0 text-left">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {label}
        </p>
        <p className="mt-0.5 text-xl font-bold tabular-nums text-[#10294B] sm:text-2xl">
          {value}
        </p>
        {hint ? (
          <p className="mt-1 text-[10px] leading-snug text-slate-400">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}

export function EspaceClientStatusPanel({
  firstName,
  subscriptionDisplay,
  collectesDisplay,
  poidsDisplay,
  subscribedHint,
}: {
  firstName: string;
  subscriptionDisplay: string;
  collectesDisplay: string;
  poidsDisplay: string;
  subscribedHint?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200/50 bg-gradient-to-br from-white via-white to-slate-50/90 p-6 shadow-[0_8px_40px_-16px_rgba(16,41,75,0.15)] ring-1 ring-white/80 sm:p-8 lg:p-10">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#CE2029]/[0.06] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-[#10294B]/[0.05] blur-3xl" />

      <div className="relative lg:grid lg:grid-cols-[1fr_auto] lg:items-center lg:gap-12">
        <div>
          <p className="text-center lg:text-left">
            <span className="font-lobster text-3xl text-[#CE2029] sm:text-4xl lg:text-[2.85rem] lg:leading-tight">
              Bonjour {firstName}
            </span>
          </p>
          <p className="mt-3 text-center text-base font-semibold leading-snug text-[#10294B] sm:text-lg lg:mt-4 lg:text-left">
            Abonnement actuel :{" "}
            <span className="font-bold tracking-wide text-[#CE2029]">
              {subscriptionDisplay}
            </span>
          </p>
          <p className="mt-2 hidden text-sm text-slate-500 lg:block lg:max-w-md">
            Gérez vos collectes et votre quota depuis l&apos;application. Les
            chiffres ci-contre se synchronisent une fois votre offre active.
          </p>
        </div>

        <div className="mt-8 flex flex-col items-stretch gap-4 sm:flex-row sm:justify-center lg:mt-0 lg:flex-col lg:items-end xl:flex-row">
          <StatCard
            icon={<IconTruck className="h-6 w-6" />}
            label="Collectes restantes"
            value={collectesDisplay}
            hint={
              subscribedHint
                ? "Détail dans l’application"
                : undefined
            }
          />
          <StatCard
            icon={<IconScale className="h-6 w-6" />}
            label="Poids disponible"
            value={poidsDisplay}
            hint={
              subscribedHint
                ? "Détail dans l’application"
                : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}
