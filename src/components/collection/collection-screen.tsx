"use client";

import { useMemo, useState } from "react";
import { MobileShell } from "@/components/layout/mobile-shell";
import { BottomNav } from "@/components/layout/bottom-nav";
import { CollectionHeader } from "@/components/collection/collection-header";
import { CollectionTabs } from "@/components/collection/collection-tabs";
import { CollectionSummary } from "@/components/collection/collection-summary";
import { CollectionItemCard } from "@/components/collection/collection-item-card";
import { ExportGoogleMapsButton } from "@/components/collection/export-google-maps-button";
import {
  COLLECTION_SPOTS,
  COLLECTION_TABS,
  filterCollectionSpots,
  type CollectionTabId,
} from "@/lib/collection-mock";

export function CollectionScreen() {
  const [activeTab, setActiveTab] = useState<CollectionTabId>("all");

  const filteredSpots = useMemo(
    () => filterCollectionSpots(activeTab, COLLECTION_SPOTS),
    [activeTab],
  );

  const totalCount =
    COLLECTION_TABS.find((tab) => tab.id === activeTab)?.count ?? 0;

  return (
    <MobileShell>
      <CollectionHeader />
      <CollectionTabs activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto pb-36">
          <CollectionSummary
            totalCount={totalCount}
            previewSpots={COLLECTION_SPOTS}
          />

          <ul className="flex flex-col gap-3 px-4 pb-4">
            {filteredSpots.map((spot) => (
              <li key={spot.id}>
                <CollectionItemCard spot={spot} />
              </li>
            ))}
          </ul>
        </div>
      </main>

      {/* Fixed CTA — absolute goal above bottom nav */}
      <div className="fixed bottom-[calc(3.75rem+env(safe-area-inset-bottom))] left-1/2 z-40 w-full max-w-[400px] -translate-x-1/2 px-4">
        <ExportGoogleMapsButton />
      </div>

      <BottomNav />
    </MobileShell>
  );
}
