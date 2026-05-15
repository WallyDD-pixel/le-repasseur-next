import Link from "next/link";

import { buttonClassName } from "@/components/ui/Button";

type Props = {
  href: string;
  label?: string;
  className?: string;
};

export function BackLink({
  href,
  label = "Retour",
  className = "",
}: Props) {
  return (
    <Link
      href={href}
      className={buttonClassName({
        variant: "secondary",
        size: "sm",
        className: `!min-h-[42px] !justify-start !px-4 !font-semibold ${className}`,
      })}
    >
      <span
        aria-hidden
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#10294B]/[0.06] text-sm text-[#10294B]"
      >
        ←
      </span>
      {label}
    </Link>
  );
}
