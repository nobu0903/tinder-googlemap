"use client";

import { cn } from "@/lib/utils";
import { COLLECTION_TABS, type CollectionTabId } from "@/lib/collection-mock";

interface CollectionTabsProps {
  activeTab: CollectionTabId;
  onTabChange: (tab: CollectionTabId) => void;
}

export function CollectionTabs({ activeTab, onTabChange }: CollectionTabsProps) {
  return (
    <div className="flex shrink-0 border-b border-white/8 px-4">
      {COLLECTION_TABS.map((tab) => {
        const isActive = tab.id === activeTab;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "relative flex-1 pb-3 pt-1 text-center text-[13px] font-semibold transition-colors",
              isActive ? "text-electric-chilli" : "text-stealth hover:text-stealth-hover",
            )}
          >
            {tab.label} ({tab.count})
            {isActive && (
              <span
                aria-hidden
                className="absolute inset-x-4 bottom-0 h-[2px] rounded-full bg-electric-chilli shadow-[0_0_8px_rgba(255,69,0,0.5)]"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
