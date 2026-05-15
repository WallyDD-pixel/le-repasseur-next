import type { InputHTMLAttributes, ReactNode } from "react";

import { Button, ButtonLink } from "@/components/ui/Button";

export function Label({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-sm font-semibold text-[#10294B]"
    >
      {children}
    </label>
  );
}

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none ring-[#CE2029]/20 transition placeholder:text-slate-400 focus:border-[#CE2029]/50 focus:ring-4 ${className}`}
      {...props}
    />
  );
}

export function PrimaryButton({
  children,
  loading,
  className = "",
  type = "button",
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <Button
      type={type}
      variant="primary"
      size="lg"
      fullWidth
      loading={loading}
      disabled={disabled}
      className={className}
      {...props}
    >
      {children}
    </Button>
  );
}

export function SecondaryLinkButton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <ButtonLink href={href} variant="secondary" size="md" fullWidth>
      {children}
    </ButtonLink>
  );
}
