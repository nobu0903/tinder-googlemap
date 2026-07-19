"use client";

import Link from "next/link";
import { Heart, Lock } from "lucide-react";

export function CollectionGate() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 pb-28 text-center">
      {/* Icon */}
      <div className="relative mb-7">
        <div className="flex size-[72px] items-center justify-center rounded-full bg-surface-raised ring-1 ring-white/8">
          <Heart
            className="size-9 text-electric-chilli/40"
            strokeWidth={1.5}
          />
        </div>
        <div className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full bg-surface-raised ring-1 ring-white/10">
          <Lock className="size-3.5 text-stealth" />
        </div>
      </div>

      {/* Copy */}
      <h2 className="text-xl font-black tracking-tight text-text-primary">
        Your likes live here
      </h2>
      <p className="mt-2.5 max-w-[260px] text-sm leading-relaxed text-text-muted">
        Sign in to save your liked spots and build a personal collection that
        follows you across sessions.
      </p>

      {/* CTA */}
      <Link
        href="/login?redirect=/collection"
        className="mt-8 flex h-12 w-full max-w-[240px] items-center justify-center rounded-xl bg-electric-chilli text-sm font-bold text-text-primary shadow-[0_4px_20px_rgba(224,62,0,0.35)] transition-all active:scale-[0.98] hover:shadow-[0_6px_28px_rgba(224,62,0,0.5)]"
      >
        Sign in or Create account
      </Link>

      <p className="mt-4 text-xs text-stealth">Free &amp; takes 30 seconds</p>
    </div>
  );
}
