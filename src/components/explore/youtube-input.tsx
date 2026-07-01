"use client";

import { useState } from "react";
import { ArrowRight, HelpCircle } from "lucide-react";

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-10" aria-hidden>
      <rect width="24" height="24" rx="5" fill="#FF0000" />
      <polygon points="10,8 10,16 17,12" fill="white" />
    </svg>
  );
}

export function YouTubeInput() {
  const [url, setUrl] = useState("");

  const handleSubmit = () => {
    console.log("YouTube URL submitted:", url);
  };

  return (
    <section className="mx-4 mt-2 overflow-hidden rounded-2xl border border-white/8 bg-surface">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="flex items-center gap-3">
          <YouTubeIcon />
          <div>
            <p className="text-[14px] font-bold leading-tight text-white">
              Discover from YouTube
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-text-muted">
              Paste a YouTube URL of a food video
              <br />
              to find amazing places near you.
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Help"
          className="mt-0.5 shrink-0 text-stealth hover:text-text-muted"
        >
          <HelpCircle className="size-5" />
        </button>
      </div>

      {/* URL input row */}
      <div className="flex items-center gap-2 p-3">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          className="h-11 flex-1 rounded-xl border border-white/10 bg-surface-raised px-3.5 text-[13px] text-white/80 placeholder:text-stealth focus:border-electric-chilli/50 focus:outline-none focus:ring-1 focus:ring-electric-chilli/30"
        />
        <button
          type="button"
          onClick={handleSubmit}
          aria-label="Search"
          className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-electric-chilli shadow-[0_4px_16px_rgba(255,69,0,0.4)] transition-transform active:scale-95 hover:bg-chilli-bright"
        >
          <ArrowRight className="size-5 text-white" />
        </button>
      </div>
    </section>
  );
}
