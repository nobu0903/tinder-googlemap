"use client";

import { ArrowRight, Clock } from "lucide-react";

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-10 opacity-60" aria-hidden>
      <rect width="24" height="24" rx="5" fill="#FF0000" />
      <polygon points="10,8 10,16 17,12" fill="white" />
    </svg>
  );
}

export function YouTubeInput() {
  return (
    <section className="mx-4 mt-2 overflow-hidden rounded-2xl border border-white/8 bg-surface opacity-80">
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="flex items-center gap-3">
          <YouTubeIcon />
          <div>
            <p className="text-[14px] font-bold leading-tight text-text-primary">
              Discover from YouTube
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-text-muted">
              Paste a food video URL to find places featured in the video.
            </p>
          </div>
        </div>
        <span className="mt-0.5 flex shrink-0 items-center gap-1 rounded-full bg-white/8 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
          <Clock className="size-3" />
          Soon
        </span>
      </div>

      <div className="flex items-center gap-2 p-3">
        <input
          type="url"
          disabled
          placeholder="Coming soon…"
          className="h-11 flex-1 cursor-not-allowed rounded-xl border border-white/10 bg-surface-raised px-3.5 text-[13px] text-stealth placeholder:text-stealth"
        />
        <button
          type="button"
          disabled
          aria-label="Coming soon"
          className="flex size-11 shrink-0 cursor-not-allowed items-center justify-center rounded-xl bg-white/10 text-stealth"
        >
          <ArrowRight className="size-5" />
        </button>
      </div>
    </section>
  );
}
