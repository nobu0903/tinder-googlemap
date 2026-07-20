"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_TABS, type NavTabId } from "@/lib/constants";

function resolveActiveTab(pathname: string): NavTabId {
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/explore")) return "explore";
  if (pathname.startsWith("/collection")) return "collection";
  return "swipe";
}

export function BottomNav() {
  const pathname = usePathname();
  const activeTab = resolveActiveTab(pathname);

  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 left-1/2 z-50 w-full max-w-[400px] -translate-x-1/2 border-t border-white/8 bg-midnight/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
    >
      <div className="flex items-stretch justify-around px-2 pt-1">
        {NAV_TABS.map((tab) => {
          const isActive = tab.id === activeTab;

          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-0.5 py-2.5 transition-colors",
                isActive
                  ? "text-electric-chilli"
                  : "text-stealth hover:text-stealth-hover",
              )}
            >
              {isActive && (
                <span
                  aria-hidden
                  className="absolute -top-px left-1/2 h-[2px] w-10 -translate-x-1/2 rounded-full bg-electric-chilli shadow-[0_0_10px_rgba(224,62,0,0.7)]"
                />
              )}
              <span className="text-lg leading-none" aria-hidden>
                {tab.emoji}
              </span>
              <span
                className={cn(
                  "text-[10px] font-semibold tracking-[0.12em]",
                  isActive && "drop-shadow-[0_0_8px_rgba(224,62,0,0.5)]",
                )}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
