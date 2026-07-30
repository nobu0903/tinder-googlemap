"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { EXPLORE_THEMES, type ExploreTheme } from "@/lib/explore-mock";
import { ACTIVE_THEME_IDS, buildThemedSwipePath } from "@/lib/explore/themes";
import { ThemeLoginPrompt } from "@/components/explore/theme-login-prompt";
import { useAuth } from "@/lib/hooks/use-auth";
import { useLang } from "@/lib/i18n/context";
import { translations } from "@/lib/i18n/translations";
import type { Coordinates } from "@/lib/hooks/use-location";

const ACTIVE_THEMES = EXPLORE_THEMES.filter((t) =>
  ACTIVE_THEME_IDS.includes(t.id as (typeof ACTIVE_THEME_IDS)[number]),
);

function ThemeTile({
  theme,
  onSelect,
}: {
  theme: ExploreTheme;
  onSelect: (theme: ExploreTheme) => void;
}) {
  const { lang } = useLang();
  const translated = translations[lang].explore.themes[theme.id];
  const name = translated?.name ?? theme.name;
  const subtitle = translated?.subtitle ?? theme.subtitle;

  return (
    <button
      type="button"
      onClick={() => onSelect(theme)}
      className="group relative aspect-[4/3] w-full overflow-hidden rounded-2xl"
    >
      <Image
        src={theme.imageUrl}
        alt={theme.imageAlt}
        fill
        sizes="(max-width: 400px) 50vw, 200px"
        className="object-cover object-center transition-transform duration-300 group-active:scale-95"
      />

      <div aria-hidden className="absolute inset-0 bg-black/45" />

      <span className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-text-primary backdrop-blur-sm">
        {theme.priceLabel}
      </span>

      <div className="absolute inset-x-0 bottom-0 p-3">
        <span className="text-xl leading-none">{theme.emoji}</span>
        <p className="mt-1 text-[13px] font-black leading-tight text-text-primary">
          {name}
        </p>
        <p className="mt-0.5 text-[11px] font-medium text-text-muted">
          {subtitle}
        </p>
      </div>
    </button>
  );
}

interface ThemeGridProps {
  coords?: Coordinates | null;
  locationLabel?: string | null;
}

interface PendingThemePrompt {
  themeName: string;
  destination: string;
}

export function ThemeGrid({ coords, locationLabel }: ThemeGridProps) {
  const router = useRouter();
  const { session, isLoading } = useAuth();
  const { t, lang } = useLang();
  const [loginPrompt, setLoginPrompt] = useState<PendingThemePrompt | null>(
    null,
  );

  const handleSelect = (theme: ExploreTheme) => {
    if (isLoading) return;

    const destination = buildThemedSwipePath(theme.id, coords, locationLabel);
    const translated = translations[lang].explore.themes[theme.id];
    const displayName = translated?.name ?? theme.name;

    if (!session) {
      setLoginPrompt({ themeName: displayName, destination });
      return;
    }

    router.push(destination);
  };

  return (
    <section className="px-4 pb-4">
      <div className="mb-3">
        <h2 className="text-[15px] font-black text-text-primary">
          {t("explore.byTheme")}
        </h2>
        <p className="mt-0.5 text-[12px] text-text-muted">
          {t("explore.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {ACTIVE_THEMES.map((theme) => (
          <ThemeTile key={theme.id} theme={theme} onSelect={handleSelect} />
        ))}
      </div>

      {loginPrompt ? (
        <ThemeLoginPrompt
          themeName={loginPrompt.themeName}
          destination={loginPrompt.destination}
          onClose={() => setLoginPrompt(null)}
        />
      ) : null}
    </section>
  );
}
