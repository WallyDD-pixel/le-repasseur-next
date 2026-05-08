import type { InputHTMLAttributes, ReactNode } from "react";

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
    <button
      type={type}
      disabled={loading || disabled}
      className={`w-full rounded-xl bg-[#CE2029] py-3.5 text-center text-base font-bold text-white shadow-lg shadow-[#CE2029]/20 transition hover:bg-[#b91b24] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...props}
    >
      {loading ? "Patientez…" : children}
    </button>
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
    <a
      href={href}
      className="block w-full rounded-xl border-2 border-[#10294B]/15 py-3 text-center text-sm font-semibold text-[#10294B] transition hover:border-[#10294B]/30 hover:bg-[#10294B]/5"
    >
      {children}
    </a>
  );
}
