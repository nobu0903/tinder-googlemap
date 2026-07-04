"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { MapPin, Clock, ChevronRight, Heart } from "lucide-react";
import { MOCK_SPOT } from "@/lib/constants";
import { cn } from "@/lib/utils";

// ── Google Maps pin SVG icon ──────────────────────────────────────────────────
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

// ── Star rating renderer ──────────────────────────────────────────────────────
function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${rating} stars`}>
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = i < Math.floor(rating);
        const half = !filled && i < rating;
        return (
          <svg
            key={i}
            viewBox="0 0 12 12"
            className="size-3"
            aria-hidden
          >
            {half ? (
              <>
                <defs>
                  <linearGradient id={`half-${i}`}>
                    <stop offset="50%" stopColor="#ffb800" />
                    <stop offset="50%" stopColor="#4b4540" />
                  </linearGradient>
                </defs>
                <path
                  fill={`url(#half-${i})`}
                  d="M6 1l1.4 2.9 3.2.5-2.3 2.2.5 3.2L6 8.3l-2.8 1.5.5-3.2L1.4 4.4l3.2-.5z"
                />
              </>
            ) : (
              <path
                fill={filled ? "#ffb800" : "#4b4540"}
                d="M6 1l1.4 2.9 3.2.5-2.3 2.2.5 3.2L6 8.3l-2.8 1.5.5-3.2L1.4 4.4l3.2-.5z"
              />
            )}
          </svg>
        );
      })}
    </span>
  );
}

// ── Review card ───────────────────────────────────────────────────────────────
function ReviewCard({ review }: { review: (typeof MOCK_SPOT.reviews)[number] }) {
  const [liked, setLiked] = useState(false);

  const daysLabel =
    review.daysAgo === 7 ? "1 week ago" : `${review.daysAgo} days ago`;

  return (
    <div className="flex gap-3 border-b border-white/6 pb-4 last:border-none last:pb-0">
      {/* Avatar */}
      <div className="relative size-9 shrink-0 overflow-hidden rounded-full ring-1 ring-white/10">
        <Image
          src={review.avatarSrc}
          alt={review.username}
          fill
          sizes="36px"
          className="object-cover object-center"
        />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[13px] font-bold text-text-primary">
              {review.username}
            </p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <StarRating rating={review.rating} />
              <span className="text-[11px] text-text-muted">{review.rating.toFixed(1)}</span>
              <span className="text-[11px] text-stealth">· {daysLabel}</span>
            </div>
          </div>

          {/* Like button */}
          <button
            type="button"
            aria-label={liked ? "Unlike" : "Like review"}
            onClick={() => setLiked((v) => !v)}
            className="mt-0.5 shrink-0 transition-transform active:scale-90"
          >
            <Heart
              className={cn(
                "size-4 transition-colors",
                liked
                  ? "fill-electric-chilli stroke-electric-chilli"
                  : "stroke-stealth",
              )}
            />
          </button>
        </div>

        <p className="mt-1.5 text-[12px] leading-relaxed text-text-muted">
          {review.text}
        </p>
      </div>
    </div>
  );
}

// ── Hours table ───────────────────────────────────────────────────────────────
function HoursTable() {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });

  return (
    <div className="mt-2 space-y-1.5">
      {MOCK_SPOT.weeklyHours.map((row) => {
        const isToday = row.day === today;
        return (
          <div
            key={row.day}
            className={cn(
              "grid grid-cols-[96px_1fr_1fr] gap-x-2 text-[12px]",
              isToday ? "font-semibold" : "font-normal",
            )}
          >
            <span className={isToday ? "text-text-primary" : "text-text-muted"}>
              {row.day}
            </span>
            <span className="text-text-muted">{row.lunch}</span>
            <span className="text-electric-chilli">{row.dinner}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main More Info Panel ──────────────────────────────────────────────────────
interface MoreInfoPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MoreInfoPanel({ isOpen, onClose }: MoreInfoPanelProps) {
  // Lock body scroll when panel is open
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      {/* Backdrop — taps outside the panel close it */}
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          "absolute inset-0 z-20 bg-black/60 backdrop-blur-[2px] transition-opacity duration-300",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
      />

      {/* Slide-up sheet */}
      <div
        role="dialog"
        aria-modal
        aria-label="Restaurant details"
        className={cn(
          // Stretch from near the top of the card down to the bottom
          "absolute inset-x-0 bottom-0 top-12 z-30 flex flex-col rounded-t-[28px] bg-surface shadow-[0_-8px_40px_rgba(0,0,0,0.6)]",
          // Slide animation
          "transition-transform duration-400 ease-[cubic-bezier(0.32,0.72,0,1)]",
          isOpen ? "translate-y-0" : "translate-y-full",
        )}
      >
        {/* Drag handle */}
        <div className="flex shrink-0 justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        {/* Scrollable content */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-8 pt-2">

          {/* ── Store name + status ── */}
          <div className="mb-4">
            <h2 className="text-[1.6rem] font-black uppercase leading-[1.05] tracking-[-0.02em] text-text-primary">
              {MOCK_SPOT.name}
            </h2>
            <p className="mt-1.5 flex items-center gap-2 text-[13px]">
              <span className="flex items-center gap-1 text-basil font-semibold">
                <span className="size-2 rounded-full bg-basil inline-block" />
                Open until {MOCK_SPOT.todayClose}
              </span>
              <span className="text-text-muted/40">·</span>
              <span className="text-text-muted">{MOCK_SPOT.category}</span>
            </p>
          </div>

          {/* ── Google Maps CTA ── */}
          <button
            type="button"
            onClick={() =>
              window.open(
                `https://maps.google.com/?q=${encodeURIComponent(MOCK_SPOT.name)}`,
                "_blank",
              )
            }
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

          {/* ── Reviews section ── */}
          <div className="mb-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[15px] font-black text-text-primary">
                Top Reviews
              </h3>
              <button
                type="button"
                className="text-[12px] font-semibold text-electric-chilli"
              >
                See All
              </button>
            </div>

            <div className="space-y-4">
              {MOCK_SPOT.reviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          </div>

          {/* ── Basic Info section ── */}
          <div>
            <h3 className="mb-3 text-[15px] font-black text-text-primary">
              Basic Info
            </h3>

            {/* Address row */}
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-xl border border-white/6 bg-surface-raised px-4 py-3 transition-colors hover:bg-white/5 active:bg-white/8"
            >
              <MapPin className="size-4 shrink-0 text-stealth" />
              <span className="flex-1 text-left text-[13px] text-text-muted">
                {MOCK_SPOT.address}
              </span>
              <ChevronRight className="size-4 shrink-0 text-stealth" />
            </button>

            {/* Business hours — always visible */}
            <div className="mt-1.5 rounded-xl border border-white/6 bg-surface-raised px-4 py-3">
              <div className="flex items-center gap-3">
                <Clock className="size-4 shrink-0 text-stealth" />
                <span className="flex-1 text-left text-[13px] font-medium text-text-muted">
                  Business hours
                </span>
              </div>
              <HoursTable />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
