"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import { MapPin } from "lucide-react";
import { useLang } from "@/lib/i18n/context";
import type { Coordinates } from "@/lib/hooks/use-location";
import "leaflet/dist/leaflet.css";

interface LocationPickerProps {
  onConfirm: (coords: Coordinates, label: string) => void;
  /** Map opens here. Tokyo when the user has no fix yet. */
  initialCoords?: Coordinates | null;
  onCancel?: () => void;
}

const TOKYO: Coordinates = { lat: 35.6812, lng: 139.7671 };

const PIN_HTML =
  '<div style="width:18px;height:18px;border-radius:999px;background:#e03e00;border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.45)"></div>';

export function LocationPicker({
  onConfirm,
  initialCoords,
  onCancel,
}: LocationPickerProps) {
  const { t } = useLang();
  const startRef = useRef(initialCoords ?? TOKYO);
  const mapNodeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);

  const [pin, setPin] = useState<Coordinates>(startRef.current);
  const [placeLabel, setPlaceLabel] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const node = mapNodeRef.current;
    if (!node) return;
    let cancelled = false;
    let observer: ResizeObserver | null = null;

    void (async () => {
      const leaflet = await import("leaflet");
      if (cancelled) return;
      const L = leaflet.default ?? leaflet;
      const map = L.map(node, { zoomControl: true }).setView(
        [startRef.current.lat, startRef.current.lng],
        13,
      );
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
      const marker = L.marker([startRef.current.lat, startRef.current.lng], {
        icon: L.divIcon({
          className: "",
          html: PIN_HTML,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
        keyboard: false,
      }).addTo(map);

      map.on("click", (event) => {
        marker.setLatLng(event.latlng);
        setPin({ lat: event.latlng.lat, lng: event.latlng.lng });
        setPlaceLabel(null);
      });

      if (cancelled) {
        map.remove();
        return;
      }

      mapRef.current = map;
      markerRef.current = marker;
      const resize = () => map.invalidateSize();
      requestAnimationFrame(resize);
      observer = new ResizeObserver(resize);
      observer.observe(node);
    })();

    return () => {
      cancelled = true;
      observer?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  const movePin = (next: Coordinates, label: string) => {
    setPin(next);
    setPlaceLabel(label);
    markerRef.current?.setLatLng([next.lat, next.lng]);
    mapRef.current?.setView([next.lat, next.lng], 15);
  };

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    if (!q || isSearching) return;
    setSearchError(null);
    setIsSearching(true);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      if (res.status === 404) {
        setSearchError(t("location.notFound"));
        return;
      }
      if (!res.ok) {
        setSearchError(t("location.searchFailed"));
        return;
      }
      const hit = (await res.json()) as { lat?: unknown; lng?: unknown; label?: unknown };
      if (typeof hit.lat !== "number" || typeof hit.lng !== "number") {
        setSearchError(t("location.searchFailed"));
        return;
      }
      const label = typeof hit.label === "string" && hit.label ? hit.label : q;
      movePin({ lat: hit.lat, lng: hit.lng }, label);
    } catch {
      setSearchError(t("location.searchFailed"));
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <div className="mb-3 flex items-center gap-2">
        <MapPin className="size-5 shrink-0 text-electric-chilli" />
        <div>
          <p className="text-sm font-bold text-text-primary">{t("location.chooseArea")}</p>
          <p className="text-[11px] text-text-muted">{t("location.locationOff")}</p>
        </div>
      </div>

      <form onSubmit={handleSearch} className="mb-3 flex gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("location.searchPlaceholder")}
          maxLength={80}
          className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-surface-raised px-3 text-[13px] text-text-primary placeholder:text-stealth focus:border-electric-chilli/50 focus:outline-none"
        />
        <button
          type="submit"
          disabled={isSearching || query.trim().length === 0}
          className="h-11 shrink-0 rounded-xl border border-white/10 px-3 text-[13px] font-bold text-text-primary transition-opacity disabled:opacity-40"
        >
          {isSearching ? t("location.searching") : t("location.search")}
        </button>
      </form>

      {searchError ? (
        <p className="mb-2 text-[12px] text-electric-chilli" role="alert">
          {searchError}
        </p>
      ) : null}

      <div
        ref={mapNodeRef}
        className="h-52 min-h-28 w-full flex-1 overflow-hidden rounded-xl border border-white/10 [&_.leaflet-container]:h-full [&_.leaflet-container]:w-full [&_.leaflet-container]:bg-surface-raised [&_.leaflet-tile]:max-w-none [&_.leaflet-tile-pane]:[filter:invert(1)_hue-rotate(180deg)_brightness(0.9)_contrast(0.9)]"
      />

      <button
        type="button"
        onClick={() => onConfirm(pin, placeLabel ?? t("location.pinnedArea"))}
        className="mt-3 h-11 w-full shrink-0 rounded-xl bg-electric-chilli text-sm font-bold text-text-primary shadow-[0_4px_16px_rgba(224,62,0,0.35)] transition-transform active:scale-[0.98]"
      >
        {t("location.useThis")}
      </button>
      {onCancel ? (
        <button
          type="button"
          onClick={onCancel}
          className="mt-2 shrink-0 text-center text-[12px] text-text-muted underline underline-offset-2"
        >
          {t("swipe.cancel")}
        </button>
      ) : null}
    </div>
  );
}
