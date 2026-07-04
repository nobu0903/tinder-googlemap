"use client";

import { Heart, Settings } from "lucide-react";

export function CollectionHeader() {
  const handleSettings = () => {
    console.log("Collection settings clicked");
  };

  return (
    <header className="relative flex shrink-0 items-center justify-center px-4 pb-3 pt-2">
      <h1 className="flex items-center gap-1.5 text-sm font-bold tracking-[0.14em] text-electric-chilli drop-shadow-[0_0_8px_rgba(224,62,0,0.3)]">
        <Heart className="size-4 fill-electric-chilli stroke-electric-chilli" />
        COLLECTION
      </h1>
      <button
        type="button"
        aria-label="Settings"
        onClick={handleSettings}
        className="absolute right-4 flex size-9 items-center justify-center rounded-full text-stealth transition-colors hover:bg-white/5 hover:text-text-muted"
      >
        <Settings className="size-5" />
      </button>
    </header>
  );
}
