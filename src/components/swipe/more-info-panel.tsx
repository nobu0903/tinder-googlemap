"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin, Clock, ChevronRight, CalendarCheck } from "lucide-react";
import { GoogleMapsIcon } from "@/components/icons/google-maps-icon";
import { cn } from "@/lib/utils";
import { buildGoogleMapsPlaceUrl } from "@/types/backend";
import { useLang } from "@/lib/i18n/context";
import type { BookingClickPayload, FeedSpot } from "@/types/backend";
import { formatWeekdayDescriptionsFromPeriods } from "@/lib/places/format";

function HoursTable({
  descriptions,
  periods,
  loading,
  t,
}: {
  descriptions: string[];
  periods: FeedSpot["openingPeriods"];
  loading?: boolean;
  t: (key: string) => string;
}) {
  const fromGoogle = (descriptions ?? []).filter(
    (line) => line.trim() && line !== "Hours not available",
  );
  const lines =
    fromGoogle.length > 0
      ? fromGoogle
      : formatWeekdayDescriptionsFromPeriods(periods ?? []);

  if (lines.length === 0) {
    return (
      <p className="mt-2 text-[12px] text-text-muted">
        {loading
          ? t("moreInfo.hoursLoading")
          : t("moreInfo.hoursNotAvailable")}
      </p>
    );
  }

  return (
    <div className="mt-2 space-y-1.5">
      {lines.map((line) => (
        <p key={line} className="text-[12px] text-text-muted">
          {line}
        </p>
      ))}
    </div>
  );
}

function hasDisplayableHours(spot: FeedSpot): boolean {
  if (spot.weekdayDescriptions?.some((l) => l.trim())) return true;
  return (spot.openingPeriods?.length ?? 0) > 0;
}

interface MoreInfoPanelProps {
  isOpen: boolean;
  onClose: () => void;
  spot: FeedSpot;
  accessToken?: string | null;
}

export function MoreInfoPanel({
  isOpen,
  onClose,
  spot,
  accessToken,
}: MoreInfoPanelProps) {
  const [displaySpot, setDisplaySpot] = useState(spot);
  const [hoursLoading, setHoursLoading] = useState(false);
  const hydratedRef = useRef<string | null>(null);
  const mapsUrl = buildGoogleMapsPlaceUrl(displaySpot.spotId, displaySpot.name);
  const { t } = useLang();

  useEffect(() => {
    setDisplaySpot(spot);
  }, [spot]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  // Force Place Details when the sheet opens without Google weekly hours.
  useEffect(() => {
    if (!isOpen) return;
    if (spot.hoursFromGoogle && hasDisplayableHours(spot)) return;
    if (hydratedRef.current === spot.spotId) return;

    const lat = spot.lat ?? 0;
    const lng = spot.lng ?? 0;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    let cancelled = false;
    hydratedRef.current = spot.spotId;
    setHoursLoading(!hasDisplayableHours(spot));

    (async () => {
      try {
        const headers: HeadersInit = { "Content-Type": "application/json" };
        if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
        const res = await fetch("/api/spots/hydrate", {
          method: "POST",
          headers,
          body: JSON.stringify({
            spotIds: [spot.spotId],
            lat,
            lng,
          }),
        });
        if (!res.ok || cancelled) {
          if (!res.ok) hydratedRef.current = null;
          return;
        }
        const data = (await res.json()) as { spots?: FeedSpot[] };
        const next = data.spots?.[0];
        if (next && !cancelled) setDisplaySpot(next);
      } catch {
        hydratedRef.current = null;
      } finally {
        if (!cancelled) setHoursLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, spot, accessToken]);

  const handleBookingClick = useCallback(() => {
    if (!displaySpot.bookingUrl) return;

    const tier: BookingClickPayload["tier"] = displaySpot.bookingUrl.includes(
      "valuecommerce",
    )
      ? 1
      : displaySpot.bookingUrl.includes("google.com/maps")
        ? 3
        : 2;

    const payload: BookingClickPayload = {
      spotId: displaySpot.spotId,
      bookingUrl: displaySpot.bookingUrl,
      tier,
    };
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    fetch("/api/analytics/booking-click", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    }).catch(() => {});

    window.open(displaySpot.bookingUrl, "_blank", "noopener,noreferrer");
  }, [displaySpot.bookingUrl, displaySpot.spotId, accessToken]);

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          "absolute inset-0 z-20 bg-black/60 backdrop-blur-[2px] transition-opacity duration-300",
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none",
        )}
      />

      <div
        role="dialog"
        aria-modal
        aria-label={t("moreInfo.ariaLabel")}
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
              {displaySpot.name}
            </h2>
            <p className="mt-1.5 flex items-center gap-2 text-[13px]">
              {displaySpot.isOpen ? (
                <span className="flex items-center gap-1 font-semibold text-basil">
                  <span className="inline-block size-2 rounded-full bg-basil" />
                  {displaySpot.todayClose
                    ? t("moreInfo.openUntil").replace(
                        "{time}",
                        displaySpot.todayClose,
                      )
                    : t("moreInfo.openNow")}
                </span>
              ) : (
                <span className="flex items-center gap-1 font-semibold text-text-muted">
                  <span className="inline-block size-2 rounded-full bg-text-muted" />
                  {t("moreInfo.closed")}
                </span>
              )}
              <span className="text-text-muted/40">·</span>
              <span className="text-text-muted">{displaySpot.category}</span>
            </p>
          </div>

          {displaySpot.bookingUrl && (
            <button
              type="button"
              onClick={handleBookingClick}
              className="mb-3 flex w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3.5 shadow-[0_6px_24px_rgba(16,185,129,0.35)] transition-transform active:scale-[0.98] hover:shadow-[0_8px_28px_rgba(16,185,129,0.5)]"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/20">
                <CalendarCheck className="size-5 text-white" />
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="text-[15px] font-bold leading-tight text-white">
                  {t("moreInfo.bookTable")}
                </p>
                <p className="text-xs font-medium text-white/75">
                  {displaySpot.bookingUrl.includes("valuecommerce")
                    ? t("moreInfo.hotpepper")
                    : t("moreInfo.onlineReservation")}
                </p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-white" />
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              window.open(mapsUrl, "_blank", "noopener,noreferrer")
            }
            className="mb-5 flex w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-electric-chilli to-chilli-bright px-4 py-3.5 shadow-[0_6px_24px_rgba(224,62,0,0.4)] transition-transform active:scale-[0.98] hover:shadow-[0_8px_28px_rgba(224,62,0,0.55)]"
          >
            <GoogleMapsIcon />
            <div className="min-w-0 flex-1 text-left">
              <p className="text-[15px] font-bold leading-tight text-text-primary">
                {t("moreInfo.openInMaps")}
              </p>
              <p className="text-xs font-medium text-text-primary/75">
                {t("moreInfo.getDirections")}
              </p>
            </div>
            <ChevronRight className="size-5 shrink-0 text-text-primary" />
          </button>

          <div className="mb-5 rounded-xl border border-white/6 bg-surface-raised px-4 py-3">
            <h3 className="text-[15px] font-black text-text-primary">
              {t("moreInfo.googleRating")}
            </h3>
            {displaySpot.rating !== null ? (
              <p className="mt-1.5 text-[13px] text-text-muted">
                <span className="text-honey">⭐ {displaySpot.rating}</span>
                {displaySpot.reviewCount !== null && (
                  <span>
                    {" "}
                    · {displaySpot.reviewCount} {t("moreInfo.reviews")}
                  </span>
                )}
              </p>
            ) : (
              <p className="mt-1.5 text-[12px] text-text-muted">
                {t("moreInfo.noRating")}
              </p>
            )}
          </div>

          <div className="pb-4">
            <h3 className="mb-3 text-[15px] font-black text-text-primary">
              {t("moreInfo.basicInfo")}
            </h3>

            {displaySpot.address && (
              <div className="flex w-full items-start gap-3 rounded-xl border border-white/6 bg-surface-raised px-4 py-3">
                <MapPin className="mt-0.5 size-4 shrink-0 text-stealth" />
                <span className="flex-1 text-left text-[13px] leading-relaxed text-text-muted">
                  {displaySpot.address}
                </span>
              </div>
            )}

            <div className="mt-1.5 rounded-xl border border-white/6 bg-surface-raised px-4 py-3">
              <div className="flex items-center gap-3">
                <Clock className="size-4 shrink-0 text-stealth" />
                <span className="flex-1 text-left text-[13px] font-medium text-text-muted">
                  {t("moreInfo.businessHours")}
                </span>
              </div>
              <HoursTable
                descriptions={displaySpot.weekdayDescriptions ?? []}
                periods={displaySpot.openingPeriods ?? []}
                loading={hoursLoading}
                t={t}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
