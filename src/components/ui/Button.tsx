import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "danger"
  | "navy"
  | "ghost";

export type ButtonSize = "sm" | "md" | "lg";

const sizeClass: Record<ButtonSize, string> = {
  sm: "min-h-[40px] px-4 py-2 text-sm",
  md: "min-h-[48px] px-5 py-2.5 text-sm",
  lg: "min-h-[52px] px-6 py-3.5 text-base",
};

const variantClass: Record<ButtonVariant, string> = {
  primary:
    "border border-transparent bg-gradient-to-r from-[#CE2029] to-[#c41e26] text-white shadow-lg shadow-[#CE2029]/25 hover:from-[#b91b24] hover:to-[#a91820] hover:shadow-xl hover:shadow-[#CE2029]/30 active:scale-[0.99]",
  secondary:
    "border-2 border-[#10294B]/20 bg-white text-[#10294B] shadow-sm hover:border-[#10294B]/35 hover:bg-[#10294B]/[0.04] active:scale-[0.99]",
  outline:
    "border-2 border-slate-200/90 bg-white/90 text-[#10294B] shadow-sm hover:border-slate-300 hover:bg-white active:scale-[0.99]",
  danger:
    "border-2 border-[#CE2029]/35 bg-white text-[#CE2029] shadow-sm hover:border-[#CE2029]/55 hover:bg-[#CE2029]/[0.06] active:scale-[0.99]",
  navy:
    "border border-transparent bg-[#10294B] text-white shadow-md shadow-[#10294B]/20 hover:bg-[#0d2240] active:scale-[0.99]",
  ghost:
    "border border-transparent bg-transparent text-[#10294B] hover:bg-[#10294B]/[0.06] hover:text-[#CE2029]",
};

const focusClass =
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#CE2029]/25";

export function buttonClassName({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}): string {
  return [
    "inline-flex items-center justify-center gap-2 rounded-xl font-bold transition",
    focusClass,
    "disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none disabled:active:scale-100",
    sizeClass[size],
    variantClass[variant],
    fullWidth ? "w-full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  loading,
  className = "",
  children,
  disabled,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={buttonClassName({ variant, size, fullWidth, className })}
      {...props}
    >
      {loading ? "Patientez…" : children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={buttonClassName({ variant, size, fullWidth, className })}
    >
      {children}
    </Link>
  );
}
