import { MapPin } from "lucide-react";

export function ExploreHeader() {
  return (
    <header className="flex shrink-0 items-center justify-center pb-3 pt-2">
      <h1 className="flex items-center gap-1.5 text-sm font-bold tracking-[0.14em] text-electric-chilli drop-shadow-[0_0_8px_rgba(255,69,0,0.3)]">
        <MapPin className="size-4 fill-electric-chilli stroke-electric-chilli" />
        EXPLORE
      </h1>
    </header>
  );
}
