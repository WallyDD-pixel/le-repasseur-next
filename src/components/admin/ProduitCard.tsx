"use client";

import Link from "next/link";
import type { DocumentData } from "firebase/firestore";
import {
  avantagesToLines,
} from "@/lib/abonnementsAdmin";
import { formatProduitPrixBadge } from "@/lib/produitsAdmin";

export function ProduitCard({
  id,
  data,
  onDelete,
}: {
  id: string;
  data: DocumentData;
  onDelete: (id: string) => void;
}) {
  const nom = typeof data.nom === "string" ? data.nom : "Sans nom";
  const description =
    typeof data.description === "string"
      ? data.description
      : typeof data.desc === "string"
        ? data.desc
        : "";
  const image = typeof data.image === "string" ? data.image : "";
  const avantagesRaw =
    typeof data.avantages === "string"
      ? data.avantages
      : typeof data.avantage === "string"
        ? data.avantage
        : "";
  const lines = avantagesToLines(avantagesRaw);

  function handleDelete() {
    if (
      typeof window !== "undefined" &&
      window.confirm(
        `Supprimer le produit « ${nom} » ? Cette action est définitive.`
      )
    ) {
      onDelete(id);
    }
  }

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_2px_24px_-6px_rgba(16,41,75,0.12)] ring-1 ring-slate-100 transition hover:shadow-[0_12px_36px_-12px_rgba(16,41,75,0.18)]">
      <div className="relative aspect-[16/10] w-full bg-gradient-to-br from-slate-100 to-slate-200/80">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            className="h-full w-full object-cover object-center"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm font-medium text-slate-400">
            Aucune image
          </div>
        )}
        <span className="absolute right-3 top-3 rounded-lg bg-[#10294B] px-2.5 py-1 text-xs font-bold text-white shadow-md">
          {formatProduitPrixBadge(data)}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h2 className="font-lobster text-2xl text-[#10294B]">{nom}</h2>
        {description ? (
          <p className="mt-1 text-sm leading-snug text-slate-600">{description}</p>
        ) : null}
        <div className="mt-4 flex-1 border-t border-slate-100 pt-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
            Avantages
          </p>
          <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-slate-700">
            {lines.length ? (
              lines.map((line, i) => (
                <li key={`${id}-${i}`} className="flex gap-2">
                  <span className="font-bold text-[#CE2029]" aria-hidden>
                    ·
                  </span>
                  <span>{line}</span>
                </li>
              ))
            ) : (
              <li className="text-sm italic text-slate-400">—</li>
            )}
          </ul>
        </div>
        <div className="mt-6 flex gap-3">
          <Link
            href={`/admin/produits/${encodeURIComponent(id)}`}
            className="inline-flex flex-1 items-center justify-center rounded-xl border-2 border-[#10294B]/25 bg-white py-2.5 text-sm font-bold text-[#10294B] shadow-sm transition hover:bg-[#10294B]/[0.06]"
          >
            Modifier
          </Link>
          <button
            type="button"
            onClick={handleDelete}
            className="inline-flex flex-1 items-center justify-center rounded-xl bg-[#CE2029] py-2.5 text-sm font-bold text-white shadow-md shadow-[#CE2029]/20 transition hover:bg-[#b91b24]"
          >
            Supprimer
          </button>
        </div>
      </div>
    </article>
  );
}
