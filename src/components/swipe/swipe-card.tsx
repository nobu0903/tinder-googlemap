"use client";



import { useState, useCallback, useEffect, useMemo, useRef } from "react";

import Image from "next/image";

import { ChevronUp, MapPin } from "lucide-react";

import { cn } from "@/lib/utils";

import { preloadPhotoUrls } from "@/lib/photos/preload";

import { MoreInfoPanel } from "./more-info-panel";

import type { FeedPhoto, FeedPhotoPage, FeedSpot } from "@/types/backend";



interface SwipeCardProps {

  spot: FeedSpot;

  className?: string;

  onMoreInfoOpenChange?: (open: boolean) => void;

  accessToken?: string | null;

  /** Only show distance for GPS nearby search — hide for travel / picked areas */
  showDistance?: boolean;

  /** Fired once when a card photo fails to load (expired Places media). */
  onPhotoError?: () => void;

}



// Reduced from 2 → 1 to limit rendered <Image> components per card.
// Each rendered photo = 1 Google Place Photo API call ($0.007); prefetching
// 2 pages ahead was loading photos the user might never reach.
const PREFETCH_AHEAD = 1;



function collectPageUrls(page: FeedPhotoPage | undefined): string[] {

  if (!page) return [];

  return page.photos.map((p) => p.url).filter(Boolean);

}



function nearbyPageIndices(pageIndex: number, pageCount: number): number[] {

  const indices = new Set<number>();

  for (let offset = -1; offset <= PREFETCH_AHEAD; offset++) {

    const idx = pageIndex + offset;

    if (idx >= 0 && idx < pageCount) indices.add(idx);

  }

  return [...indices].sort((a, b) => a - b);

}



interface PhotoSlotProps {

  photo: FeedPhoto | undefined;

  priority?: boolean;

  onPhotoError?: () => void;

}



function PhotoSlot({
  photo,
  priority = false,
  onPhotoError,
}: PhotoSlotProps) {
  const [failed, setFailed] = useState(false);
  const errorNotifiedRef = useRef(false);

  // New URL after forced photo refresh — allow Image to try again.
  useEffect(() => {
    setFailed(false);
    errorNotifiedRef.current = false;
  }, [photo?.url]);

  // Skeleton stays behind the image — never gate the <Image> on onLoad.
  // Cached Next/Image responses often skip a late onLoad; opacity-0 then stuck forever.
  if (!photo?.url || failed) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-muted">
        No photo available
      </div>
    );
  }

  return (
    <>
      <div
        aria-hidden
        className="absolute inset-0 animate-pulse bg-surface-raised"
      />
      <Image
        key={photo.url}
        src={photo.url}
        alt={photo.alt}
        fill
        priority={priority}
        sizes="(max-width: 400px) 100vw, 400px"
        // Proxied Places photos already include size via /api/photo — skip
        // /_next/image (avoids localPatterns 400 + double-fetch billing risk).
        unoptimized
        onError={() => {
          setFailed(true);
          if (!errorNotifiedRef.current) {
            errorNotifiedRef.current = true;
            onPhotoError?.();
          }
        }}
        className="object-cover object-center"
      />
    </>
  );
}



interface PhotoPageLayerProps {

  page: FeedPhotoPage;

  isActive: boolean;

  priority?: boolean;

  onPhotoError?: () => void;

}



function PhotoPageLayer({
  page,
  isActive,
  priority = false,
  onPhotoError,
}: PhotoPageLayerProps) {

  const isDualStack = page.layoutType === "DUAL_STACK";

  const topPhoto = page.photos[0];

  const bottomPhoto = isDualStack ? page.photos[1] : null;



  return (

    <div

      aria-hidden={!isActive}

      className={cn(
        "absolute inset-0 flex flex-col",
        // Prefer opacity over visibility:hidden so lazy Next/Image still loads
        isActive
          ? "z-10 opacity-100"
          : "z-0 opacity-0 pointer-events-none",
      )}

    >

      <div className="relative min-h-0 flex-1 overflow-hidden bg-surface-raised">

        <PhotoSlot
          photo={topPhoto}
          priority={priority}
          onPhotoError={onPhotoError}
        />

      </div>



      {isDualStack && bottomPhoto?.url && (

        <>

          <div aria-hidden className="h-px shrink-0 bg-black" />

          <div className="relative min-h-0 flex-1 overflow-hidden bg-surface-raised">

            <PhotoSlot photo={bottomPhoto} onPhotoError={onPhotoError} />

          </div>

        </>

      )}

    </div>

  );

}



export function SwipeCard({

  spot,

  className,

  onMoreInfoOpenChange,

  accessToken,

  showDistance = true,

  onPhotoError,

}: SwipeCardProps) {

  const pages = useMemo(
    () => (spot.photoPages.length > 0 ? spot.photoPages : []),
    [spot.photoPages],
  );

  const pageCount = Math.max(pages.length, 1);

  const [pageIndex, setPageIndex] = useState(0);

  const [moreInfoOpen, setMoreInfoOpen] = useState(false);



  const renderedIndices = useMemo(

    () => nearbyPageIndices(pageIndex, pageCount),

    [pageIndex, pageCount],

  );



  useEffect(() => {

    setPageIndex(0);

  }, [spot.id]);



  useEffect(() => {

    const urls = renderedIndices.flatMap((idx) => collectPageUrls(pages[idx]));

    preloadPhotoUrls(urls);

  }, [renderedIndices, pages, spot.id]);



  const handleMoreInfo = () => {

    setMoreInfoOpen((open) => !open);

  };



  useEffect(() => {

    onMoreInfoOpenChange?.(moreInfoOpen);

  }, [moreInfoOpen, onMoreInfoOpenChange]);



  const handleTap = useCallback(

    (e: React.MouseEvent<HTMLDivElement>) => {

      const { clientX, currentTarget } = e;

      const { left, width } = currentTarget.getBoundingClientRect();

      const relativeX = clientX - left;



      if (relativeX < width / 2) {

        setPageIndex((i) => (i > 0 ? i - 1 : i));

      } else {

        setPageIndex((i) => (i < pageCount - 1 ? i + 1 : i));

      }

    },

    [pageCount],

  );



  return (

    <article

      className={cn(

        "relative z-0 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[32px] shadow-[0_12px_40px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.06)]",

        moreInfoOpen ? "overflow-visible" : "overflow-hidden",

        className,

      )}

    >

      <div

        className={cn(

          "relative flex min-h-0 flex-1 cursor-pointer select-none flex-col",

          pageCount > 1 && "cursor-pointer",

        )}

        onClick={handleTap}

      >

        {pageCount > 1 && (

          <div

            aria-label={`Photo ${pageIndex + 1} of ${pageCount}`}

            className="absolute inset-x-3 top-3 z-20 flex gap-1"

            onClick={(e) => e.stopPropagation()}

          >

            {Array.from({ length: pageCount }).map((_, i) => (

              <div

                key={i}

                className={cn(

                  "h-[3px] flex-1 rounded-full transition-all duration-300",

                  i === pageIndex

                    ? "bg-white shadow-[0_0_4px_rgba(255,255,255,0.6)]"

                    : "bg-white/35",

                )}

              />

            ))}

          </div>

        )}



        {showDistance && (

          <div className="absolute right-4 top-9 z-20">

            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-text-primary backdrop-blur-sm ring-1 ring-white/10">

              <MapPin className="size-3.5 text-text-muted" />

              {spot.distanceKm} km away

            </span>

          </div>

        )}



        <div className="relative min-h-0 flex-1 overflow-hidden">

          {pages.length > 0 ? (

            renderedIndices.map((idx) => (

              <PhotoPageLayer

                key={idx}

                page={pages[idx]}

                isActive={idx === pageIndex}

                priority={idx === pageIndex || idx === 0}

                onPhotoError={onPhotoError}

              />

            ))

          ) : (

            <div className="flex h-full items-center justify-center text-sm text-text-muted">

              No photo available

            </div>

          )}

        </div>

      </div>



      <div className="shrink-0 bg-surface px-5 pb-10 pt-4">

        <div className="flex items-center justify-between gap-3">

          <div className="min-w-0 flex-1">

            <h2 className="text-[1.5rem] font-black uppercase leading-[1.05] tracking-[-0.02em] text-text-primary">

              {spot.name}

            </h2>

            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[12px] font-medium">

              {spot.rating !== null && (

                <span className="text-honey">⭐ {spot.rating}</span>

              )}

              {spot.reviewCount !== null && (

                <span className="text-text-muted">({spot.reviewCount})</span>

              )}

              <span className="text-text-muted/40">|</span>

              <span className={spot.isOpen ? "text-basil" : "text-text-muted"}>

                {spot.isOpen ? "🟢 Open Now" : "🔴 Closed"}

              </span>

              {spot.priceLabel && (

                <>

                  <span className="text-text-muted/40">|</span>

                  <span className="text-chilli-bright">{spot.priceLabel}</span>

                </>

              )}

            </p>

          </div>



          <button

            type="button"

            aria-label="More Info"

            onClick={handleMoreInfo}

            className={cn(

              "flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-text-primary ring-1 ring-white/15 transition-all hover:bg-white/20",

              moreInfoOpen && "rotate-180",

            )}

          >

            <ChevronUp className="size-5 stroke-[3] transition-transform duration-300" />

          </button>

        </div>

      </div>



      <MoreInfoPanel

        isOpen={moreInfoOpen}

        onClose={() => setMoreInfoOpen(false)}

        spot={spot}

        accessToken={accessToken}

      />

    </article>

  );

}

