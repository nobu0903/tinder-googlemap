import Image from "next/image";
import { Heart } from "lucide-react";
import type { CollectionSpot } from "@/lib/collection-mock";

interface CollectionSummaryProps {
  totalCount: number;
  previewSpots: CollectionSpot[];
}

export function CollectionSummary({
  totalCount,
  previewSpots,
}: CollectionSummaryProps) {
  return (
    <section className="flex items-center justify-between px-4 py-5">
      <div>
        <p className="text-sm font-medium text-white/90">Your Collection ✨</p>
        <p className="mt-0.5 text-4xl font-black leading-none text-electric-chilli">
          {totalCount}
        </p>
        <p className="mt-1 text-xs text-text-muted">Amazing places saved</p>
      </div>

      <div className="relative h-[72px] w-[120px] shrink-0">
        {previewSpots.slice(0, 5).map((spot, index) => (
          <div
            key={spot.id}
            className="absolute overflow-hidden rounded-full ring-2 ring-midnight"
            style={{
              width: 44,
              height: 44,
              right: index * 14,
              top: index % 2 === 0 ? 0 : 12,
              zIndex: 5 - index,
            }}
          >
            <Image
              src={spot.images[0].src}
              alt={spot.images[0].alt}
              fill
              sizes="44px"
              className="object-cover"
            />
          </div>
        ))}
        <div className="absolute -bottom-1 right-0 z-10 flex size-8 items-center justify-center rounded-full bg-white shadow-md">
          <Heart className="size-4 fill-electric-chilli stroke-electric-chilli" />
        </div>
      </div>
    </section>
  );
}
