"use client";

import { useState } from "react";
import Image from "next/image";
import { withPhotoMaxWidth } from "@/lib/places/photo-url";
import { COLLECTION_CARD_PHOTO_WIDTH } from "@/types/backend";
import { cn } from "@/lib/utils";

interface CollectionPhotoProps {
  src: string;
  alt: string;
  /** Eager-load above-the-fold cards only */
  priority?: boolean;
  sizes?: string;
  className?: string;
  /** Override Google maxWidthPx (default: collection card width) */
  maxWidthPx?: number;
}

/**
 * Collection photo with skeleton shimmer + fade-in.
 * Always requests a downscaled Places media URL to cut transfer size.
 */
export function CollectionPhoto({
  src,
  alt,
  priority = false,
  sizes = "(max-width: 400px) 100vw, 400px",
  className,
  maxWidthPx = COLLECTION_CARD_PHOTO_WIDTH,
}: CollectionPhotoProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const optimizedSrc = withPhotoMaxWidth(src, maxWidthPx);

  return (
    <div className={cn("absolute inset-0", className)}>
      {!isLoaded && (
        <div
          aria-hidden
          className="absolute inset-0 animate-pulse bg-surface-raised"
        />
      )}
      <Image
        src={optimizedSrc}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        loading={priority ? "eager" : "lazy"}
        onLoad={() => setIsLoaded(true)}
        className={cn(
          "object-cover object-center transition-opacity duration-300",
          isLoaded ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}
