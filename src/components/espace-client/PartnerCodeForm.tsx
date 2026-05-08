"use client";

import { useState } from "react";

export function PartnerCodeForm() {
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setMsg("Saisissez un code ou laissez vide.");
      return;
    }
    setMsg(
      "Merci. Si votre code est valide, notre équipe activera votre avantage sous peu. En cas de doute, contactez-nous."
    );
    setCode("");
  }

  return (
    <div className="lg:max-w-2xl">
      <p className="text-center text-sm font-semibold text-[#10294B] lg:text-left">
        Code partenaire ou promotionnel
      </p>
      <p className="mt-1 text-center text-xs text-slate-500 lg:text-left">
        Offres spéciales, parrainage ou partenaires locaux
      </p>
      <form
        onSubmit={onSubmit}
        className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-stretch"
      >
        <label htmlFor="partner-code" className="sr-only">
          Saisissez votre code partenaire
        </label>
        <input
          id="partner-code"
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setMsg(null);
          }}
          placeholder="Ex. PARTENAIRE2025"
          className="min-h-[50px] flex-1 rounded-xl border border-slate-200/90 bg-white px-4 text-[#10294B] shadow-sm outline-none ring-0 transition placeholder:text-slate-400 focus:border-[#10294B]/30 focus:ring-4 focus:ring-[#CE2029]/10"
          autoComplete="off"
        />
        <button
          type="submit"
          className="min-h-[50px] shrink-0 rounded-xl bg-[#10294B] px-8 text-sm font-bold text-white shadow-md transition hover:bg-[#0d213d] hover:shadow-lg"
        >
          Valider
        </button>
      </form>
      {msg ? (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-center text-sm text-slate-600 lg:text-left">
          {msg}
        </p>
      ) : null}
    </div>
  );
}
