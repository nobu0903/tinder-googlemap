"use client";

import Image from "next/image";
import { Heart } from "lucide-react";
import { MobileShell } from "@/components/layout/mobile-shell";
import { BottomNav } from "@/components/layout/bottom-nav";
import { CollectionHeader } from "@/components/collection/collection-header";
import { CollectionGate } from "@/components/collection/collection-gate";
import { CollectionItemCard } from "@/components/collection/collection-item-card";
import { ExportGoogleMapsButton } from "@/components/collection/export-google-maps-button";
import { useAuth } from "@/lib/hooks/use-auth";
import { useCollection } from "@/lib/hooks/use-collection";

export function CollectionScreen() {
  const { session, isLoading: authLoading } = useAuth();
  const { spots, isLoading: collectionLoading } = useCollection({
    accessToken: session?.access_token ?? null,
    enabled: !authLoading && Boolean(session),
  });

  // ── Still checking auth ──────────────────────────────────────────────────
  if (authLoading) {
    return (
      <MobileShell>
        <CollectionHeader />
        <div className="flex flex-1 items-center justify-center">
          <div className="size-8 animate-spin rounded-full border-2 border-surface-raised border-t-electric-chilli" />
        </div>
        <BottomNav />
      </MobileShell>
    );
  }

  // ── Not signed in ────────────────────────────────────────────────────────
  if (!session) {
    return (
      <MobileShell>
        <CollectionHeader />
        <CollectionGate />
        <BottomNav />
      </MobileShell>
    );
  }

  // ── Signed in ────────────────────────────────────────────────────────────
  return (
    <MobileShell>
      <CollectionHeader />

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto pb-36">

          {/* Summary row */}
          <section className="flex items-center justify-between px-4 py-5">
            <div>
              <p className="text-sm font-medium text-text-primary">
                Your Collection ✨
              </p>
              <p className="mt-0.5 text-4xl font-black leading-none text-electric-chilli">
                {collectionLoading ? "…" : spots.length}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                {spots.length === 1 ? "amazing place saved" : "amazing places saved"}
              </p>
            </div>

            {/* Preview avatars */}
            {spots.length > 0 && (
              <div className="relative h-[72px] w-[120px] shrink-0">
                {spots.slice(0, 5).map((spot, index) => (
                  <div
                    key={spot.spotId}
                    className="absolute overflow-hidden rounded-full ring-2 ring-midnight"
                    style={{
                      width: 44,
                      height: 44,
                      right: index * 14,
                      top: index % 2 === 0 ? 0 : 12,
                      zIndex: 5 - index,
                    }}
                  >
                    {spot.photos[0] ? (
                      <Image
                        src={spot.photos[0].url}
                        alt={spot.name}
                        fill
                        sizes="44px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="size-full bg-surface-raised" />
                    )}
                  </div>
                ))}
                <div className="absolute -bottom-1 right-0 z-10 flex size-8 items-center justify-center rounded-full bg-white shadow-md">
                  <Heart className="size-4 fill-electric-chilli stroke-electric-chilli" />
                </div>
              </div>
            )}
          </section>

          {/* Loading */}
          {collectionLoading && (
            <div className="flex items-center justify-center py-16">
              <div className="size-8 animate-spin rounded-full border-2 border-surface-raised border-t-electric-chilli" />
            </div>
          )}

          {/* Empty state */}
          {!collectionLoading && spots.length === 0 && (
            <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
              <span className="mb-4 text-5xl">🍜</span>
              <p className="text-sm font-semibold text-text-primary">
                No liked spots yet
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-text-muted">
                Swipe right on spots you love — they&apos;ll appear here.
              </p>
            </div>
          )}

          {/* Spot cards */}
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

      {/* Export CTA — above bottom nav */}
      {spots.length > 0 && (
        <div className="fixed bottom-[calc(3.75rem+env(safe-area-inset-bottom))] left-1/2 z-40 w-full max-w-[400px] -translate-x-1/2 px-4">
          <ExportGoogleMapsButton
            spotIds={spots.map((s) => s.spotId)}
            spotNames={spots.map((s) => s.name)}
          />
        </div>
      )}

      <BottomNav />
    </MobileShell>
  );
}
