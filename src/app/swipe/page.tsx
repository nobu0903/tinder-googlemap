import { Suspense } from "react";
import { SwipeScreen } from "@/components/swipe/swipe-screen";

export default function SwipePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-sm text-text-muted">
          Loading…
        </div>
      }
    >
      <SwipeScreen />
    </Suspense>
  );
}
