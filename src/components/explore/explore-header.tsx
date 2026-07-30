"use client";

import { MapPin } from "lucide-react";
import { useLang } from "@/lib/i18n/context";

interface ExploreHeaderProps {
  locationLabel?: string | null;
}

export function ExploreHeader({ locationLabel }: ExploreHeaderProps) {
  const { t } = useLang();
  return (
    <header className="flex shrink-0 flex-col items-center pb-3 pt-2">
      <h1 className="flex items-center gap-1.5 text-sm font-bold tracking-[0.14em] text-electric-chilli drop-shadow-[0_0_8px_rgba(224,62,0,0.3)]">
        <MapPin className="size-4 fill-electric-chilli stroke-electric-chilli" />
        {t("explore.header")}
      </h1>
      {locationLabel && (
        <p className="mt-1 text-[10px] text-stealth">📍 {locationLabel}</p>
      )}
    </header>
  );
}
