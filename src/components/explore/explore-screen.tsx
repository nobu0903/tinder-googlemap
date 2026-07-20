"use client";

import { useState } from "react";
import { MobileShell } from "@/components/layout/mobile-shell";
import { BottomNav } from "@/components/layout/bottom-nav";
import { ExploreHeader } from "@/components/explore/explore-header";
import { ThemeGrid } from "@/components/explore/theme-grid";
import { LocationPicker } from "@/components/location/location-picker";
import { useLocation } from "@/lib/hooks/use-location";
import type { Coordinates } from "@/lib/hooks/use-location";

export function ExploreScreen() {
  const { coords, status, setManualCoords } = useLocation();
  const [locationLabel, setLocationLabel] = useState<string | null>(null);

  const displayLabel =
    locationLabel ?? (status === "ready" ? "Near you" : null);
  const needsLocationPicker = status === "denied" || status === "unsupported";

  const handleLocationConfirm = (nextCoords: Coordinates, label: string) => {
    setManualCoords(nextCoords);
    setLocationLabel(label);
  };

  return (
    <MobileShell>
      <ExploreHeader locationLabel={displayLabel} />

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto pb-24">
          {needsLocationPicker ? (
            <div className="mt-4 px-4">
              <LocationPicker onConfirm={handleLocationConfirm} />
            </div>
          ) : null}

          <div className={needsLocationPicker ? "mt-4" : "mt-5"}>
            <ThemeGrid coords={coords} locationLabel={locationLabel} />
          </div>
        </div>
      </main>

      <BottomNav />
    </MobileShell>
  );
}
