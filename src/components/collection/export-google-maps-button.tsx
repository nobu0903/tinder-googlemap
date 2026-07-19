"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { buildGoogleMapsPlaceUrl } from "@/types/backend";

interface ExportGoogleMapsButtonProps {
  spotIds: string[];
  spotNames: string[];
}

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

export function ExportGoogleMapsButton({
  spotIds,
  spotNames,
}: ExportGoogleMapsButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleExport = async () => {
    if (spotIds.length === 0) return;

    // Build a text list of Google Maps URLs for all liked spots
    const lines = spotIds.map(
      (id, i) =>
        `${i + 1}. ${spotNames[i] ?? id}\n   ${buildGoogleMapsPlaceUrl(id, spotNames[i])}`,
    );
    const text = `My VibeLoop Collection (${spotIds.length} spots)\n\n${lines.join("\n\n")}`;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback: open first spot in Maps if clipboard is unavailable
      const first = buildGoogleMapsPlaceUrl(spotIds[0], spotNames[0]);
      window.open(first, "_blank");
    }
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      className="flex w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-electric-chilli to-chilli-bright px-4 py-3.5 shadow-[0_6px_24px_rgba(224,62,0,0.45)] transition-transform active:scale-[0.98] hover:shadow-[0_8px_28px_rgba(224,62,0,0.55)]"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white">
        {copied ? (
          <Check className="size-5 text-basil" />
        ) : (
          <GoogleMapsPinIcon />
        )}
      </div>
      <div className="min-w-0 flex-1 text-left">
        <p className="text-[15px] font-bold leading-tight text-text-primary">
          {copied ? "Copied to clipboard!" : "Export to Google Maps"}
        </p>
        <p className="text-xs font-medium text-text-primary/80">
          {copied
            ? "Paste your list anywhere"
            : `Copy all ${spotIds.length} spot${spotIds.length !== 1 ? "s" : ""} as links`}
        </p>
      </div>
      {!copied && (
        <ArrowRight className="size-5 shrink-0 text-text-primary" />
      )}
    </button>
  );
}
