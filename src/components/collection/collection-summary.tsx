import { Heart } from "lucide-react";
import type { LikedSpot } from "@/types/backend";

interface CollectionSummaryProps {
  totalCount: number;
  /** When true, show an ellipsis instead of the numeric count */
  isLoading?: boolean;
  previewSpots: LikedSpot[];
}

/** Stable pastel from spot id — no network, avoids competing with list photo loads. */
function avatarTone(spotId: string): string {
  const tones = [
    "bg-electric-chilli/35",
    "bg-honey/30",
    "bg-basil/30",
    "bg-chilli-bright/25",
    "bg-white/12",
  ];
  let hash = 0;
  for (let i = 0; i < spotId.length; i++) {
    hash = (hash + spotId.charCodeAt(i) * (i + 1)) % tones.length;
  }
  return tones[hash] ?? tones[0];
}

/**
 * Summary header. Preview circles are decorative (no Google photo fetch)
 * so the list owns all image bandwidth.
 */
export function CollectionSummary({
  totalCount,
  isLoading = false,
  previewSpots,
}: CollectionSummaryProps) {
  const label =
    totalCount === 1 ? "amazing place saved" : "amazing places saved";

  return (
    <section className="flex items-center justify-between px-4 py-5">
      <div>
        <p className="text-sm font-medium text-text-primary">
          Your Collection ✨
        </p>
        <p className="mt-0.5 text-4xl font-black leading-none text-electric-chilli">
          {isLoading ? "…" : totalCount}
        </p>
        <p className="mt-1 text-xs text-text-muted">{label}</p>
      </div>

      {previewSpots.length > 0 && (
        <div className="relative h-[72px] w-[120px] shrink-0">
          {previewSpots.slice(0, 5).map((spot, index) => (
            <div
              key={spot.spotId}
              className={`absolute flex items-center justify-center overflow-hidden rounded-full ring-2 ring-midnight ${avatarTone(spot.spotId)}`}
              style={{
                width: 44,
                height: 44,
                right: index * 14,
                top: index % 2 === 0 ? 0 : 12,
                zIndex: 5 - index,
              }}
              title={spot.name}
            >
              <span className="text-[13px] font-black text-text-primary/90">
                {spot.name.trim().charAt(0).toUpperCase() || "·"}
              </span>
            </div>
          ))}
          <div className="absolute -bottom-1 right-0 z-10 flex size-8 items-center justify-center rounded-full bg-white shadow-md">
            <Heart className="size-4 fill-electric-chilli stroke-electric-chilli" />
          </div>
        </div>
      )}
    </section>
  );
}
