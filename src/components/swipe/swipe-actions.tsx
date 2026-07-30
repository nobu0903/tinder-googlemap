"use client";

import { Heart, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SwipeAction } from "@/types/backend";

interface SwipeActionsProps {
  className?: string;
  hidden?: boolean;
  onSwipe?: (action: SwipeAction) => void;
}

export function SwipeActions({ className, hidden, onSwipe }: SwipeActionsProps) {
  const handleDislike = () => onSwipe?.("dislike");
  const handleLike = () => onSwipe?.("like");

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 z-30 flex translate-y-1/2 items-center justify-center gap-8 transition-opacity duration-200",
        hidden && "pointer-events-none opacity-0",
        className,
      )}
    >
      <button
        type="button"
        aria-label="Pass"
        onClick={handleDislike}
        className="pointer-events-auto flex size-[66px] items-center justify-center rounded-full border border-white/20 bg-surface-raised text-text-primary shadow-[0_4px_16px_rgba(0,0,0,0.45)] transition-transform active:scale-95 hover:border-white/30 hover:bg-surface"
      >
        <X className="size-7 stroke-[2.5]" />
      </button>

      <button
        type="button"
        aria-label="Like"
        onClick={handleLike}
        className="pointer-events-auto flex size-[66px] items-center justify-center rounded-full bg-electric-chilli text-text-primary shadow-[0_4px_16px_rgba(0,0,0,0.45)] transition-transform active:scale-95 hover:bg-chilli-deep"
      >
        <Heart className="size-7 fill-white stroke-white" />
      </button>
    </div>
  );
}
