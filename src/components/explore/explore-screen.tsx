import { MobileShell } from "@/components/layout/mobile-shell";
import { BottomNav } from "@/components/layout/bottom-nav";
import { ExploreHeader } from "@/components/explore/explore-header";
import { YouTubeInput } from "@/components/explore/youtube-input";
import { ThemeGrid } from "@/components/explore/theme-grid";

export function ExploreScreen() {
  return (
    <MobileShell>
      <ExploreHeader />

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto pb-24">
          <YouTubeInput />

          <div className="mt-5">
            <ThemeGrid />
          </div>
        </div>
      </main>

      <BottomNav />
    </MobileShell>
  );
}
