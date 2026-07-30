"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { SwipeAction } from "@/types/backend";

/** Horizontal distance (px) at which a release commits the swipe */
const SWIPE_THRESHOLD = 90;
/** Max card tilt while dragging */
const MAX_ROTATION_DEG = 10;
/** How far the card drifts on commit (fraction of card width — keep short) */
const EXIT_MULTIPLIER = 0.45;
/** Exit / snap-back animation duration (ms) */
const EXIT_MS = 520;
/** Ignore photo-tap if finger moved more than this */
const TAP_SLOP_PX = 12;
/** Prefer horizontal vs vertical before locking swipe */
const AXIS_LOCK_RATIO = 1.15;

interface SwipeableCardProps {
  children: ReactNode;
  /** Disables drag (e.g. when More Info panel is open) */
  disabled?: boolean;
  /** Called after the fly-off animation finishes */
  onSwipe: (action: SwipeAction) => void;
  className?: string;
  /** Imperative swipe trigger for the action buttons */
  swipeRef?: React.MutableRefObject<((action: SwipeAction) => void) | null>;
  /** Resets transform when the underlying card identity changes */
  itemKey: string;
}

export function SwipeableCard({
  children,
  disabled = false,
  onSwipe,
  className,
  swipeRef,
  itemKey,
}: SwipeableCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackingRef = useRef(false);
  const draggingRef = useRef(false);
  const exitingRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const offsetXRef = useRef(0);
  const offsetYRef = useRef(0);
  /** True only after a real horizontal drag — used to swallow the synthetic click */
  const didSwipeGestureRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const axisLockedRef = useRef<"h" | "v" | null>(null);

  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    exitingRef.current = false;
    trackingRef.current = false;
    draggingRef.current = false;
    didSwipeGestureRef.current = false;
    axisLockedRef.current = null;
    offsetXRef.current = 0;
    offsetYRef.current = 0;
    setOffset({ x: 0, y: 0 });
    setIsAnimating(false);
  }, [itemKey]);

  const commitSwipe = useCallback(
    (action: SwipeAction) => {
      if (exitingRef.current || disabled) return;
      exitingRef.current = true;
      trackingRef.current = false;
      draggingRef.current = false;

      const width = containerRef.current?.offsetWidth ?? 360;
      const exitX =
        action === "like"
          ? width * EXIT_MULTIPLIER
          : -width * EXIT_MULTIPLIER;
      const exitY = offsetYRef.current * 0.4;

      setIsAnimating(true);
      setOffset({ x: exitX, y: exitY });
      offsetXRef.current = exitX;
      offsetYRef.current = exitY;

      window.setTimeout(() => {
        onSwipe(action);
      }, EXIT_MS);
    },
    [disabled, onSwipe],
  );

  useEffect(() => {
    if (!swipeRef) return;
    swipeRef.current = commitSwipe;
    return () => {
      swipeRef.current = null;
    };
  }, [swipeRef, commitSwipe]);

  const snapBack = useCallback(() => {
    setIsAnimating(true);
    setOffset({ x: 0, y: 0 });
    offsetXRef.current = 0;
    offsetYRef.current = 0;
    window.setTimeout(() => setIsAnimating(false), EXIT_MS);
  }, []);

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || exitingRef.current) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;

    const target = e.target as HTMLElement | null;
    if (target?.closest("button, a, input, textarea, select, [role='button']")) {
      return;
    }

    // Do NOT capture yet — capturing here suppresses photo left/right taps.
    pointerIdRef.current = e.pointerId;
    trackingRef.current = true;
    draggingRef.current = false;
    didSwipeGestureRef.current = false;
    axisLockedRef.current = null;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    offsetXRef.current = 0;
    offsetYRef.current = 0;
    setIsAnimating(false);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!trackingRef.current || exitingRef.current) return;
    if (pointerIdRef.current !== e.pointerId) return;

    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;

    if (axisLockedRef.current === null) {
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (absX < TAP_SLOP_PX && absY < TAP_SLOP_PX) return;

      // Vertical → abandon (let scroll / ignore); keep photo tap clickable
      if (absY > absX * AXIS_LOCK_RATIO) {
        axisLockedRef.current = "v";
        trackingRef.current = false;
        return;
      }

      // Horizontal → start swipe drag
      if (absX > absY * AXIS_LOCK_RATIO) {
        axisLockedRef.current = "h";
        draggingRef.current = true;
        didSwipeGestureRef.current = true;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      } else {
        return;
      }
    }

    if (axisLockedRef.current !== "h" || !draggingRef.current) return;

    offsetXRef.current = dx;
    offsetYRef.current = dy * 0.35;
    setOffset({ x: offsetXRef.current, y: offsetYRef.current });
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId) return;
    pointerIdRef.current = null;

    const wasDragging = draggingRef.current;
    trackingRef.current = false;
    draggingRef.current = false;

    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // already released
      }
    }

    if (exitingRef.current) return;

    // Pure tap (no horizontal lock) — leave click alone for photo paging
    if (!wasDragging || axisLockedRef.current !== "h") {
      axisLockedRef.current = null;
      return;
    }

    const x = offsetXRef.current;
    if (x >= SWIPE_THRESHOLD) {
      commitSwipe("like");
    } else if (x <= -SWIPE_THRESHOLD) {
      commitSwipe("dislike");
    } else {
      snapBack();
    }
    axisLockedRef.current = null;
  };

  const handleClickCapture = (e: React.MouseEvent) => {
    if (didSwipeGestureRef.current) {
      e.stopPropagation();
      e.preventDefault();
      didSwipeGestureRef.current = false;
    }
  };

  const rotation = (offset.x / SWIPE_THRESHOLD) * MAX_ROTATION_DEG;
  const clampedRotation = Math.max(
    -MAX_ROTATION_DEG,
    Math.min(MAX_ROTATION_DEG, rotation),
  );

  const likeOpacity = Math.min(Math.max(offset.x / SWIPE_THRESHOLD, 0), 1);
  const nopeOpacity = Math.min(Math.max(-offset.x / SWIPE_THRESHOLD, 0), 1);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex min-h-0 flex-1 flex-col touch-pan-y will-change-transform",
        !disabled && "cursor-grab active:cursor-grabbing",
        className,
      )}
      style={{
        transform: `translate3d(${offset.x}px, ${offset.y}px, 0) rotate(${clampedRotation}deg)`,
        transition: isAnimating
          ? `transform ${EXIT_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1)`
          : "none",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClickCapture={handleClickCapture}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-2 top-8 z-40 w-[68%] max-w-[260px] -rotate-12"
        style={{ opacity: likeOpacity }}
      >
        <Image
          src="/ramens/LIKE.png"
          alt=""
          width={480}
          height={480}
          className="h-auto w-full drop-shadow-[0_4px_20px_rgba(0,0,0,0.55)]"
          draggable={false}
          priority
        />
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute right-2 top-8 z-40 w-[72%] max-w-[280px] rotate-12"
        style={{ opacity: nopeOpacity }}
      >
        <Image
          src="/ramens/NOPE.png"
          alt=""
          width={520}
          height={300}
          className="h-auto w-full drop-shadow-[0_4px_20px_rgba(0,0,0,0.55)]"
          draggable={false}
          priority
        />
      </div>

      {children}
    </div>
  );
}
