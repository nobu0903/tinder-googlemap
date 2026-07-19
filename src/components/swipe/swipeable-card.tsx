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
  const draggingRef = useRef(false);
  const exitingRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const offsetXRef = useRef(0);
  const offsetYRef = useRef(0);
  const movedRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);

  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isAnimating, setIsAnimating] = useState(false);

  // Reset pose whenever the card identity changes
  useEffect(() => {
    exitingRef.current = false;
    draggingRef.current = false;
    offsetXRef.current = 0;
    offsetYRef.current = 0;
    setOffset({ x: 0, y: 0 });
    setIsAnimating(false);
  }, [itemKey]);

  const commitSwipe = useCallback(
    (action: SwipeAction) => {
      if (exitingRef.current || disabled) return;
      exitingRef.current = true;
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
        // Parent will swap itemKey → effect resets pose
      }, EXIT_MS);
    },
    [disabled, onSwipe],
  );

  // Expose imperative trigger for SwipeActions buttons
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
    // Only primary button / touch
    if (e.pointerType === "mouse" && e.button !== 0) return;

    // Don't steal gestures from buttons / links inside the card (More Info etc.)
    const target = e.target as HTMLElement | null;
    if (target?.closest("button, a, input, textarea, select, [role='button']")) {
      return;
    }

    draggingRef.current = true;
    movedRef.current = false;
    pointerIdRef.current = e.pointerId;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    setIsAnimating(false);

    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || exitingRef.current) return;
    if (pointerIdRef.current !== e.pointerId) return;

    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;

    if (Math.abs(dx) > TAP_SLOP_PX || Math.abs(dy) > TAP_SLOP_PX) {
      movedRef.current = true;
    }

    offsetXRef.current = dx;
    offsetYRef.current = dy * 0.35; // damp vertical drift
    setOffset({ x: offsetXRef.current, y: offsetYRef.current });
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || exitingRef.current) return;
    if (pointerIdRef.current !== e.pointerId) return;

    draggingRef.current = false;
    pointerIdRef.current = null;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // already released
    }

    const x = offsetXRef.current;
    if (x >= SWIPE_THRESHOLD) {
      commitSwipe("like");
    } else if (x <= -SWIPE_THRESHOLD) {
      commitSwipe("dislike");
    } else {
      snapBack();
    }
  };

  // Swallow click after a drag so photo page-tap doesn't fire
  const handleClickCapture = (e: React.MouseEvent) => {
    if (movedRef.current) {
      e.stopPropagation();
      e.preventDefault();
      movedRef.current = false;
    }
  };

  const rotation =
    (offset.x / SWIPE_THRESHOLD) * MAX_ROTATION_DEG;
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
        "relative flex min-h-0 flex-1 flex-col touch-none will-change-transform",
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
      {/* LIKE stamp — top-left, Tinder-style */}
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

      {/* NOPE stamp — top-right, Tinder-style */}
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
