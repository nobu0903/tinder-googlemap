"use client";

import Link from "next/link";
import { Smartphone } from "lucide-react";
import { useLang } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

interface WaitlistHeaderButtonProps {
  className?: string;
}

/** Compact header chip → /waitlist (mobile app interest list). */
export function WaitlistHeaderButton({ className }: WaitlistHeaderButtonProps) {
  const { t } = useLang();

  return (
    <Link
      href="/waitlist"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold tracking-[0.08em] text-text-muted transition-colors hover:border-electric-chilli/35 hover:text-electric-chilli",
        className,
      )}
      aria-label={t("waitlist.headerAria")}
    >
      <Smartphone className="size-3 shrink-0" aria-hidden />
      <span>App</span>
    </Link>
  );
}
