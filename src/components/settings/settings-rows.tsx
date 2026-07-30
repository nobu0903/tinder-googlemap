import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function SettingsSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-6 px-5">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
        {label}
      </p>
      <div className="overflow-hidden rounded-2xl border border-white/8 bg-surface">
        {children}
      </div>
    </section>
  );
}

export function SettingsRowInfo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-white/6 px-4 py-3.5">
      <span className="text-sm text-text-muted">{label}</span>
      <span className="max-w-[55%] truncate text-right text-sm text-text-primary">
        {value}
      </span>
    </div>
  );
}

export function SettingsRowButton({
  label,
  icon,
  labelClassName,
  onClick,
}: {
  label: string;
  icon?: ReactNode;
  labelClassName?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/5 active:bg-white/10"
    >
      {icon ? <span className="shrink-0">{icon}</span> : null}
      <span className={cn("flex-1 text-left text-sm", labelClassName)}>
        {label}
      </span>
    </button>
  );
}

export function SettingsRowLink({
  label,
  icon,
  href,
  labelClassName,
  bordered = false,
}: {
  label: string;
  icon?: ReactNode;
  href: string;
  labelClassName?: string;
  bordered?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/5 active:bg-white/10",
        bordered && "border-t border-white/6",
      )}
    >
      {icon ? <span className="shrink-0">{icon}</span> : null}
      <span className={cn("flex-1 text-sm", labelClassName)}>{label}</span>
      <ChevronRight className="size-4 text-neutral-600" />
    </Link>
  );
}

export function SettingsRowExternalLink({
  label,
  icon,
  href,
}: {
  label: string;
  icon?: ReactNode;
  href: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/5 active:bg-white/10"
    >
      {icon ? <span className="shrink-0">{icon}</span> : null}
      <span className="flex-1 text-sm text-text-primary">{label}</span>
      <ChevronRight className="size-4 text-neutral-600" />
    </a>
  );
}
