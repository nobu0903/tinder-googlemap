"use client";

import { MobileShell } from "@/components/layout/mobile-shell";
import { BottomNav } from "@/components/layout/bottom-nav";
import { CollectionHeader } from "@/components/collection/collection-header";
import { CollectionGate } from "@/components/collection/collection-gate";
import { CollectionItemCard } from "@/components/collection/collection-item-card";
import { CollectionSummary } from "@/components/collection/collection-summary";
import { useAuth } from "@/lib/hooks/use-auth";
import { useCollection } from "@/lib/hooks/use-collection";

function CollectionSpinner() {
  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <div className="size-8 animate-spin rounded-full border-2 border-surface-raised border-t-electric-chilli" />
    </div>
  );
}

function CollectionEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
      <span className="mb-4 text-5xl">🍜</span>
      <p className="text-sm font-semibold text-text-primary">
        No liked spots yet
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-text-muted">
        Swipe right on spots you love — they&apos;ll appear here.
      </p>
    </div>
  );
}

export function CollectionScreen() {
  const { session, isLoading: authLoading } = useAuth();
  const { spots, isLoading: collectionLoading } = useCollection({
    accessToken: session?.access_token ?? null,
    enabled: !authLoading && Boolean(session),
  });

  if (authLoading) {
    return (
      <MobileShell>
        <CollectionHeader />
        <CollectionSpinner />
        <BottomNav />
      </MobileShell>
    );
  }

  if (!session) {
    return (
      <MobileShell>
        <CollectionHeader />
        <CollectionGate />
        <BottomNav />
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      <CollectionHeader />

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto pb-24">
          <CollectionSummary
            totalCount={spots.length}
            isLoading={collectionLoading}
            previewSpots={spots}
          />

          {collectionLoading && <CollectionSpinner />}

          {!collectionLoading && spots.length === 0 && <CollectionEmptyState />}

          {!collectionLoading && spots.length > 0 && (
            <ul className="flex flex-col gap-3 px-4 pb-4">
              {spots.map((spot) => (
                <li key={spot.spotId}>
                  <CollectionItemCard spot={spot} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      <BottomNav />
    </MobileShell>
  );
}
