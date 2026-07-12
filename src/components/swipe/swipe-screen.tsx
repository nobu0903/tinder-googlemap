"use client";



import { useState } from "react";

import { MobileShell } from "@/components/layout/mobile-shell";

import { BottomNav } from "@/components/layout/bottom-nav";

import { SwipeCard } from "@/components/swipe/swipe-card";

import { SwipeActions } from "@/components/swipe/swipe-actions";

import { useSwipeFeed } from "@/lib/hooks/use-swipe-feed";



export function SwipeScreen() {

  const [moreInfoOpen, setMoreInfoOpen] = useState(false);



  const {

    currentSpot,

    isInitialLoading,

    isRefetching,

    isLocating,

    error,

    recordSwipe,

  } = useSwipeFeed();



  const showFullScreenLoading =

    isLocating || (isInitialLoading && !currentSpot);

  const showCard = !isLocating && currentSpot;



  return (

    <MobileShell>

      <main className="flex min-h-0 flex-1 flex-col px-4 pb-28 pt-6">

        <header className="mb-4 shrink-0 flex flex-col items-center">

          <h1 className="text-sm font-bold tracking-[0.18em] text-electric-chilli drop-shadow-[0_0_8px_rgba(224,62,0,0.25)]">

            🔥 SWIPE

          </h1>

          <span

            aria-hidden

            className="mt-1.5 h-[2px] w-12 rounded-full bg-electric-chilli shadow-[0_0_8px_rgba(224,62,0,0.5)]"

          />

        </header>



        {showFullScreenLoading && (

          <div className="flex flex-1 items-center justify-center">

            <p className="text-sm text-text-muted animate-pulse">

              {isLocating ? "Finding your location…" : "Loading spots…"}

            </p>

          </div>

        )}



        {!showFullScreenLoading && error && !currentSpot && (

          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">

            <p className="text-sm font-semibold text-text-primary">

              Could not load spots

            </p>

            <p className="text-xs leading-relaxed text-text-muted">{error}</p>

          </div>

        )}



        {!showFullScreenLoading && !error && !currentSpot && (

          <div className="flex flex-1 items-center justify-center px-6 text-center">

            <p className="text-sm text-text-muted">

              No spots found nearby. Try again later.

            </p>

          </div>

        )}



        {showCard && (

          <section className="flex min-h-0 flex-1 flex-col pb-2">

            {isRefetching && (

              <p className="mb-2 text-center text-[10px] font-medium tracking-wide text-text-muted/70">

                Loading more spots…

              </p>

            )}

            <div className="relative flex min-h-0 flex-1 flex-col">

              <SwipeCard

                spot={currentSpot}

                onMoreInfoOpenChange={setMoreInfoOpen}

              />

              <SwipeActions

                hidden={moreInfoOpen}

                onSwipe={recordSwipe}

              />

            </div>

          </section>

        )}

      </main>



      <BottomNav />

    </MobileShell>

  );

}

