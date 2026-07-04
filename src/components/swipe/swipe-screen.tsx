"use client";

import { useState } from "react";
import { MobileShell } from "@/components/layout/mobile-shell";
import { BottomNav } from "@/components/layout/bottom-nav";
import { SwipeCard } from "@/components/swipe/swipe-card";
import { SwipeActions } from "@/components/swipe/swipe-actions";

export function SwipeScreen() {
  const [moreInfoOpen, setMoreInfoOpen] = useState(false);

  return (
    <MobileShell>
      <main className="flex min-h-0 flex-1 flex-col px-4 pb-28 pt-6">
        {/* Tab header */}
        <header className="mb-4 shrink-0 flex flex-col items-center">
          <h1 className="text-sm font-bold tracking-[0.18em] text-electric-chilli drop-shadow-[0_0_8px_rgba(224,62,0,0.25)]">
            🔥 SWIPE
          </h1>
          <span
            aria-hidden
            className="mt-1.5 h-[2px] w-12 rounded-full bg-electric-chilli shadow-[0_0_8px_rgba(224,62,0,0.5)]"
          />
        </header>

        {/* Card fills remaining height; actions overlap card bottom */}
        <section className="flex min-h-0 flex-1 flex-col pb-2">
          <div className="relative flex min-h-0 flex-1 flex-col">
            <SwipeCard onMoreInfoOpenChange={setMoreInfoOpen} />
            <SwipeActions hidden={moreInfoOpen} />
          </div>
        </section>
      </main>

      <BottomNav />
    </MobileShell>
  );
}
