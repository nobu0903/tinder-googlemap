"use client";

import { Heart, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SwipeActionsProps {
  className?: string;
}

export function SwipeActions({ className }: SwipeActionsProps) {
  const handleDislike = () => {
    console.log("Dislike — pass");
  };

  const handleLike = () => {
    console.log("Like — saved to collection");
  };

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 z-30 flex translate-y-1/2 items-center justify-center gap-8",
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
        className="pointer-events-auto flex size-[66px] items-center justify-center rounded-full bg-gradient-to-br from-chilli-bright via-electric-chilli to-chilli-deep text-text-primary shadow-[0_4px_20px_rgba(224,62,0,0.5),0_0_12px_rgba(224,62,0,0.2)] transition-transform active:scale-95 hover:shadow-[0_6px_24px_rgba(224,62,0,0.6),0_0_16px_rgba(224,62,0,0.3)]"
      >
        <Heart className="size-7 fill-white stroke-white" />
      </button>
    </div>
  );
}
