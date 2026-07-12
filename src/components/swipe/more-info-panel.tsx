"use client";

import { useEffect } from "react";
import { MapPin, Clock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildGoogleMapsPlaceUrl } from "@/types/backend";
import type { FeedSpot } from "@/types/backend";

function GoogleMapsIcon() {
  return (
    <svg viewBox="0 0 40 40" className="size-8 shrink-0" aria-hidden>
      <circle cx="20" cy="20" r="20" fill="white" />
      <path
        fill="#EA4335"
        d="M20 8c-5.52 0-10 4.48-10 10 0 7.5 10 18 10 18s10-10.5 10-18c0-5.52-4.48-10-10-10z"
      />
      <circle cx="20" cy="18" r="3.5" fill="#B31412" />
    </svg>
  );
}

function HoursTable({ descriptions }: { descriptions: string[] }) {
  if (descriptions.length === 0) {
    return (
      <p className="mt-2 text-[12px] text-text-muted">Hours not available</p>
    );
  }

  return (
    <div className="mt-2 space-y-1.5">
      {descriptions.map((line) => (
        <p key={line} className="text-[12px] text-text-muted">
          {line}
        </p>
      ))}
    </div>
  );
}

interface MoreInfoPanelProps {
  isOpen: boolean;
  onClose: () => void;
  spot: FeedSpot;
}

export function MoreInfoPanel({ isOpen, onClose, spot }: MoreInfoPanelProps) {
  const mapsUrl = buildGoogleMapsPlaceUrl(spot.spotId, spot.name);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          "absolute inset-0 z-20 bg-black/60 backdrop-blur-[2px] transition-opacity duration-300",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
      />

      <div
        role="dialog"
        aria-modal
        aria-label="Restaurant details"
        className={cn(
          "absolute inset-x-0 bottom-0 top-12 z-30 flex flex-col rounded-t-[28px] bg-surface shadow-[0_-8px_40px_rgba(0,0,0,0.6)]",
          "transition-transform duration-400 ease-[cubic-bezier(0.32,0.72,0,1)]",
          isOpen ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="flex shrink-0 justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-2">
          <div className="mb-4">
            <h2 className="text-[1.6rem] font-black uppercase leading-[1.05] tracking-[-0.02em] text-text-primary">
              {spot.name}
            </h2>
            <p className="mt-1.5 flex items-center gap-2 text-[13px]">
              {spot.isOpen && spot.todayClose ? (
                <span className="flex items-center gap-1 font-semibold text-basil">
                  <span className="inline-block size-2 rounded-full bg-basil" />
                  Open until {spot.todayClose}
                </span>
              ) : (
                <span className="flex items-center gap-1 font-semibold text-text-muted">
                  <span className="inline-block size-2 rounded-full bg-text-muted" />
                  Closed
                </span>
              )}
              <span className="text-text-muted/40">·</span>
              <span className="text-text-muted">{spot.category}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={() => window.open(mapsUrl, "_blank")}
            className="mb-5 flex w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-electric-chilli to-chilli-bright px-4 py-3.5 shadow-[0_6px_24px_rgba(224,62,0,0.4)] transition-transform active:scale-[0.98] hover:shadow-[0_8px_28px_rgba(224,62,0,0.55)]"
          >
            <GoogleMapsIcon />
            <div className="min-w-0 flex-1 text-left">
              <p className="text-[15px] font-bold leading-tight text-text-primary">
                Open in Google Maps
              </p>
              <p className="text-xs font-medium text-text-primary/75">
                Get directions
              </p>
            </div>
            <ChevronRight className="size-5 shrink-0 text-text-primary" />
          </button>

          {/* Rating summary from Google Places */}
          <div className="mb-5 rounded-xl border border-white/6 bg-surface-raised px-4 py-3">
            <h3 className="text-[15px] font-black text-text-primary">
              Google Rating
            </h3>
            {spot.rating !== null ? (
              <p className="mt-1.5 text-[13px] text-text-muted">
                <span className="text-honey">⭐ {spot.rating}</span>
                {spot.reviewCount !== null && (
                  <span> · {spot.reviewCount} reviews</span>
                )}
              </p>
            ) : (
              <p className="mt-1.5 text-[12px] text-text-muted">
                No rating available
              </p>
            )}
          </div>

          <div className="pb-4">
            <h3 className="mb-3 text-[15px] font-black text-text-primary">
              Basic Info
            </h3>

            {spot.address && (
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-xl border border-white/6 bg-surface-raised px-4 py-3 transition-colors hover:bg-white/5 active:bg-white/8"
              >
                <MapPin className="size-4 shrink-0 text-stealth" />
                <span className="flex-1 text-left text-[13px] text-text-muted">
                  {spot.address}
                </span>
                <ChevronRight className="size-4 shrink-0 text-stealth" />
              </button>
            )}

            <div className="mt-1.5 rounded-xl border border-white/6 bg-surface-raised px-4 py-3">
              <div className="flex items-center gap-3">
                <Clock className="size-4 shrink-0 text-stealth" />
                <span className="flex-1 text-left text-[13px] font-medium text-text-muted">
                  Business hours
                </span>
              </div>
              <HoursTable descriptions={spot.weekdayDescriptions} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
