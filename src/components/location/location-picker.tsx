"use client";

import { useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import {
  JAPAN_PREFECTURES,
  type Municipality,
  type Prefecture,
} from "@/lib/japan-locations";
import type { Coordinates } from "@/lib/hooks/use-location";

interface LocationPickerProps {
  onConfirm: (coords: Coordinates, label: string) => void;
}

export function LocationPicker({ onConfirm }: LocationPickerProps) {
  const [prefectureId, setPrefectureId] = useState(JAPAN_PREFECTURES[0]?.id ?? "");
  const [municipalityId, setMunicipalityId] = useState("");

  const prefecture = useMemo(
    () => JAPAN_PREFECTURES.find((p) => p.id === prefectureId),
    [prefectureId],
  );

  const municipalities = useMemo(
    () => prefecture?.municipalities ?? [],
    [prefecture],
  );

  const selectedMunicipality: Municipality | undefined = useMemo(() => {
    if (municipalityId) {
      return municipalities.find((m) => m.id === municipalityId);
    }
    return municipalities[0];
  }, [municipalityId, municipalities]);

  const handlePrefectureChange = (nextId: string) => {
    setPrefectureId(nextId);
    const nextPref = JAPAN_PREFECTURES.find((p) => p.id === nextId);
    setMunicipalityId(nextPref?.municipalities[0]?.id ?? "");
  };

  const handleConfirm = () => {
    if (!prefecture || !selectedMunicipality) return;
    onConfirm(
      { lat: selectedMunicipality.lat, lng: selectedMunicipality.lng },
      `${selectedMunicipality.name}, ${prefecture.name}`,
    );
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-surface p-5">
        <div className="mb-4 flex items-center gap-2">
          <MapPin className="size-5 text-electric-chilli" />
          <div>
            <p className="text-sm font-bold text-text-primary">Choose your area</p>
            <p className="text-[11px] text-text-muted">
              Location access is off. Pick a prefecture and city.
            </p>
          </div>
        </div>

        <label className="mb-3 block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            Prefecture
          </span>
          <select
            value={prefectureId}
            onChange={(e) => handlePrefectureChange(e.target.value)}
            className="h-11 w-full rounded-xl border border-white/10 bg-surface-raised px-3 text-[13px] text-text-primary focus:border-electric-chilli/50 focus:outline-none"
          >
            {JAPAN_PREFECTURES.map((p: Prefecture) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="mb-5 block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            City / Area
          </span>
          <select
            value={municipalityId || municipalities[0]?.id || ""}
            onChange={(e) => setMunicipalityId(e.target.value)}
            className="h-11 w-full rounded-xl border border-white/10 bg-surface-raised px-3 text-[13px] text-text-primary focus:border-electric-chilli/50 focus:outline-none"
          >
            {municipalities.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={handleConfirm}
          className="h-11 w-full rounded-xl bg-electric-chilli text-sm font-bold text-text-primary shadow-[0_4px_16px_rgba(224,62,0,0.35)] transition-transform active:scale-[0.98]"
        >
          Use this location
        </button>
      </div>
    </div>
  );
}
