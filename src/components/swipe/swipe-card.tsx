"use client";

import Image from "next/image";
import { ChevronUp, MapPin } from "lucide-react";
import { MOCK_SPOT } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface SwipeCardProps {
  className?: string;
}

export function SwipeCard({ className }: SwipeCardProps) {
  const handleMoreInfo = () => {
    console.log("More Info clicked — Menya Soul Heaven");
  };

  return (
    <article
      className={cn(
        "relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[32px] shadow-[0_12px_40px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.06)]",
        className,
      )}
    >
      {/* Full-bleed photo — entire card, no white footer */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <Image
          src={MOCK_SPOT.imageUrl}
          alt={MOCK_SPOT.imageAlt}
          fill
          priority
          sizes="(max-width: 400px) 100vw, 400px"
          className="object-cover object-center"
        />

        {/* Bottom gradient — concentrated at lower edge so photo stays hero */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-[36%] bg-gradient-to-t from-black/75 via-black/30 to-transparent"
        />

        {/* Distance badge — top right */}
        <div className="absolute right-4 top-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm ring-1 ring-white/10">
            <MapPin className="size-3.5 text-white/80" />
            {MOCK_SPOT.distanceKm} km away
          </span>
        </div>

        {/* Info stack — Tinder-style, pinned low on photo */}
        <div className="absolute inset-x-0 bottom-0 px-5 pb-[3.25rem]">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-[1.625rem] font-black uppercase leading-[1.05] tracking-[-0.02em] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.55)]">
                {MOCK_SPOT.name}
              </h2>

              <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[12px] font-medium">
                <span className="text-chilli-bright">⭐ {MOCK_SPOT.rating}</span>
                <span className="text-white/70">({MOCK_SPOT.reviewCount})</span>
                <span className="text-white/30">•</span>
                <span className="text-[#6ee76e]">🟢 Open Now</span>
                <span className="text-white/30">•</span>
                <span className="text-chilli-bright">¥{MOCK_SPOT.priceRange}</span>
              </p>
            </div>

            <button
              type="button"
              aria-label="More Info"
              onClick={handleMoreInfo}
              className="mb-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm ring-1 ring-white/10 transition-colors hover:bg-black/70"
            >
              <ChevronUp className="size-5 stroke-[3]" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
