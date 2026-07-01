import { MobileShell } from "@/components/layout/mobile-shell";
import { BottomNav } from "@/components/layout/bottom-nav";

export default function ExplorePage() {
  return (
    <MobileShell>
      <main className="flex flex-1 flex-col items-center justify-center px-4 pb-28 pt-6">
        <header className="mb-5 flex flex-col items-center">
          <h1 className="text-sm font-bold tracking-[0.18em] text-stealth">
            🔍 EXPLORE
          </h1>
        </header>
        <p className="text-center text-sm text-stealth">Coming soon</p>
      </main>
      <BottomNav />
    </MobileShell>
  );
}
