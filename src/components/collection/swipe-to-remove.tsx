"use client";

import {
  useCallback,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n/context";

/** Commit remove when released past this left offset (px) */
const REMOVE_THRESHOLD = 88;
/** Cap how far the row can be dragged */
const MAX_DRAG = 140;
/** Ignore vertical scroll when |dx| exceeds this vs |dy| */
const AXIS_LOCK_RATIO = 1.15;
const TAP_SLOP_PX = 10;
const EXIT_MS = 220;
const COLLAPSE_MS = 200;

interface SwipeToRemoveProps {
  children: ReactNode;
  disabled?: boolean;
  onRemove: () => void;
  className?: string;
}

/**
 * Gmail-style swipe-left-to-remove.
 * Reveals a red trash affordance; past threshold the row flies out and collapses.
 * Pointer capture is deferred until a left-swipe is confirmed so photo taps still work.
 */
export function SwipeToRemove({
  children,
  disabled = false,
  onRemove,
  className,
}: SwipeToRemoveProps) {
  const { t } = useLang();
  const trackRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const offsetRef = useRef(0);
  const trackingRef = useRef(false);
  const axisLockedRef = useRef<"h" | "v" | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const exitingRef = useRef(false);
  const didSwipeRef = useRef(false);

  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [rowHeight, setRowHeight] = useState<number | undefined>(undefined);

  const resetPose = useCallback(() => {
    offsetRef.current = 0;
    setOffsetX(0);
    setIsDragging(false);
    axisLockedRef.current = null;
  }, []);

  const commitRemove = useCallback(() => {
    if (exitingRef.current || disabled) return;
    exitingRef.current = true;
    trackingRef.current = false;

    const height = trackRef.current?.offsetHeight ?? 160;
    setRowHeight(height);
    setIsExiting(true);
    setOffsetX(-(trackRef.current?.offsetWidth ?? 360));

    window.setTimeout(() => {
      setIsCollapsed(true);
      window.setTimeout(() => {
        onRemove();
      }, COLLAPSE_MS);
    }, EXIT_MS);
  }, [disabled, onRemove]);

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || exitingRef.current || e.button !== 0) return;
    // Do NOT capture yet — capturing here suppresses click on the photo card.
    pointerIdRef.current = e.pointerId;
    trackingRef.current = true;
    didSwipeRef.current = false;
    axisLockedRef.current = null;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
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

      // Vertical → let the list scroll; abandon swipe tracking
      if (absY > absX * AXIS_LOCK_RATIO) {
        axisLockedRef.current = "v";
        trackingRef.current = false;
        resetPose();
        return;
      }

      // Horizontal left only — start remove gesture
      if (absX > absY * AXIS_LOCK_RATIO && dx < 0) {
        axisLockedRef.current = "h";
        didSwipeRef.current = true;
        setIsDragging(true);
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      } else if (absX > absY * AXIS_LOCK_RATIO && dx > 0) {
        // Swipe right is not used — treat as cancelled so taps still work
        axisLockedRef.current = "v";
        trackingRef.current = false;
        return;
      } else {
        return;
      }
    }

    if (axisLockedRef.current !== "h") return;

    const next = Math.max(-MAX_DRAG, Math.min(0, dx));
    offsetRef.current = next;
    setOffsetX(next);
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId) return;
    pointerIdRef.current = null;
    trackingRef.current = false;

    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // already released
      }
    }

    if (exitingRef.current) return;

    const shouldRemove =
      axisLockedRef.current === "h" && offsetRef.current <= -REMOVE_THRESHOLD;

    setIsDragging(false);

    if (shouldRemove) {
      commitRemove();
      return;
    }

    resetPose();
  };

  const handleClickCapture = (e: React.MouseEvent) => {
    // After a real left-swipe gesture, block the synthetic click on the card
    if (didSwipeRef.current) {
      e.preventDefault();
      e.stopPropagation();
      didSwipeRef.current = false;
    }
  };

  const progress = Math.min(1, Math.abs(offsetX) / REMOVE_THRESHOLD);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl transition-[height,margin,opacity] ease-out",
        isCollapsed && "pointer-events-none opacity-0",
        className,
      )}
      style={{
        height: isCollapsed ? 0 : rowHeight,
        marginBottom: isCollapsed ? 0 : undefined,
        transitionDuration: `${COLLAPSE_MS}ms`,
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0 flex items-center justify-end bg-[#c5221f] px-6"
      >
        <div
          className="flex items-center gap-2 text-white transition-transform duration-150"
          style={{
            transform: `scale(${0.85 + progress * 0.2})`,
            opacity: 0.55 + progress * 0.45,
          }}
        >
          <Trash2 className="size-5" strokeWidth={2.25} />
          <span className="text-sm font-bold tracking-wide">{t("collection.remove")}</span>
        </div>
      </div>

      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClickCapture={handleClickCapture}
        className={cn(
          "relative touch-pan-y will-change-transform",
          isDragging
            ? "transition-none"
            : "transition-transform duration-200 ease-out",
          isExiting && "transition-transform duration-200 ease-in",
        )}
        style={{ transform: `translate3d(${offsetX}px, 0, 0)` }}
      >
        {children}
        {!disabled && (
          <button
            type="button"
            aria-label={t("collection.removeAriaLabel")}
            onClick={(e) => {
              e.stopPropagation();
              if (exitingRef.current) return;
              commitRemove();
            }}
            className="absolute bottom-3 left-3 z-20 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white ring-1 ring-white/20 backdrop-blur-sm transition-opacity hover:bg-black/70"
          >
            {t("collection.remove")}
          </button>
        )}
      </div>
    </div>
  );
}
