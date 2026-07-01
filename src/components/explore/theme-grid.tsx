"use client";

import Image from "next/image";
import { EXPLORE_THEMES, type ExploreTheme } from "@/lib/explore-mock";

function ThemeTile({ theme }: { theme: ExploreTheme }) {
  const handleClick = () => {
    console.log("Theme selected:", theme.name);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="group relative aspect-[4/3] w-full overflow-hidden rounded-2xl"
    >
      <Image
        src={theme.imageUrl}
        alt={theme.imageAlt}
        fill
        sizes="(max-width: 400px) 50vw, 200px"
        className="object-cover object-center transition-transform duration-300 group-active:scale-95"
      />

      {/* Dark overlay */}
      <div
        aria-hidden
        className="absolute inset-0 bg-black/45"
      />

      {/* Price badge — top right */}
      <span className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white/90 backdrop-blur-sm">
        {theme.priceLabel}
      </span>

      {/* Bottom info */}
      <div className="absolute inset-x-0 bottom-0 p-3">
        <span className="text-xl leading-none">{theme.emoji}</span>
        <p className="mt-1 text-[13px] font-black leading-tight text-white">
          {theme.name}
        </p>
        <p className="mt-0.5 text-[11px] font-medium text-white/65">
          {theme.subtitle}
        </p>
      </div>
    </button>
  );
}

export function ThemeGrid() {
  return (
    <section className="px-4 pb-4">
      <div className="mb-3">
        <h2 className="text-[15px] font-black text-white">Explore by Theme</h2>
        <p className="mt-0.5 text-[12px] text-text-muted">
          Pick a vibe. We&apos;ll show you the perfect spots.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {EXPLORE_THEMES.map((theme) => (
          <ThemeTile key={theme.id} theme={theme} />
        ))}
      </div>
    </section>
  );
}
