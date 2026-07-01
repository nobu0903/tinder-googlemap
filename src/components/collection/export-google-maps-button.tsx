"use client";

import { ArrowRight } from "lucide-react";

function GoogleMapsPinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
      />
      <circle cx="12" cy="9" r="2.5" fill="#B31412" />
    </svg>
  );
}

export function ExportGoogleMapsButton() {
  const handleExport = () => {
    console.log("Export to Google Maps clicked");
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      className="flex w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-electric-chilli to-chilli-bright px-4 py-3.5 shadow-[0_6px_24px_rgba(255,69,0,0.45)] transition-transform active:scale-[0.98] hover:shadow-[0_8px_28px_rgba(255,69,0,0.55)]"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white">
        <GoogleMapsPinIcon />
      </div>
      <div className="min-w-0 flex-1 text-left">
        <p className="text-[15px] font-bold leading-tight text-white">
          Export to Google Maps
        </p>
        <p className="text-xs font-medium text-white/80">Save all to your map</p>
      </div>
      <ArrowRight className="size-5 shrink-0 text-white" />
    </button>
  );
}
