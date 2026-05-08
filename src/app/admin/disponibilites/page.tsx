"use client";

import { DisponibilitesManager } from "@/components/admin/DisponibilitesManager";

export default function AdminDisponibilitesPage() {
  return (
    <div className="mx-auto max-w-[1600px]">
      <header className="mb-8">
        <p className="text-xs font-bold uppercase tracking-wider text-[#CE2029]">
          Gestion
        </p>
        <h1 className="font-lobster text-3xl text-[#10294B] sm:text-4xl">
          Disponibilités
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Source principale : document{" "}
          <code className="rounded bg-slate-100 px-1 text-xs">
            availability / availability
          </code>{" "}
          — carte imbriquée par date (AAAA-MM-JJ), puis jour en français, liste{" "}
          <code className="rounded bg-slate-100 px-1 text-xs">intervals</code>{" "}
          (heures de début). Les entrées optionnelles avec timestamps sont dans la
          collection <code className="rounded bg-slate-100 px-1 text-xs">disponibilites</code>.
        </p>
      </header>
      <DisponibilitesManager />
    </div>
  );
}
