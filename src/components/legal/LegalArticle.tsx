import type { ReactNode } from "react";

import { BackLink } from "@/components/ui/BackLink";

export function LegalArticle({
  children,
  backHref = "/",
  backLabel = "Retour à l'accueil",
}: {
  children: ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="space-y-8">
      <BackLink href={backHref} label={backLabel} />
      <article
        className={[
          "space-y-8 text-sm leading-relaxed text-slate-700",
          "[&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-[#10294B] [&_h2]:tracking-tight",
          "[&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-[#10294B]",
          "[&_ol]:list-decimal [&_ol]:space-y-6 [&_ol]:pl-5",
          "[&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5",
          "[&_p]:text-slate-700",
          "[&_strong]:font-semibold [&_strong]:text-[#10294B]",
          "[&_a]:font-semibold [&_a]:text-[#CE2029] [&_a]:underline [&_a]:decoration-[#CE2029]/30",
        ].join(" ")}
      >
        {children}
      </article>
    </div>
  );
}
