// src/components/PullToRefresh.jsx
import { useEffect, useRef, useState } from "react";

const THRESHOLD = 70;   // px of pull needed to trigger a refresh
const MAX_PULL = 110;   // cap so the content can't be dragged forever
const RESISTANCE = 0.5; // pull feels heavier than the finger actually moves

/**
 * Wraps a list and triggers `onRefresh` when the user pulls down from the top.
 * Touch devices only — no listeners are bound on desktop.
 *
 * `onRefresh` must return a promise; the spinner stays visible until it settles.
 */
export default function PullToRefresh({ onRefresh, children, disabled = false }) {
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const containerRef = useRef(null);
  const startY = useRef(0);
  const pulling = useRef(false);
  const distRef = useRef(0);      // mirrors `distance` for the touchend closure
  const animating = useRef(false); // disables the transition mid-drag

  useEffect(() => {
    if (disabled || typeof window === "undefined") return;
    if (!("ontouchstart" in window)) return;

    const el = containerRef.current;
    if (!el) return;

    const atTop = () => {
      // Page scroll position, plus the wrapper's own offset from the viewport.
      const rect = el.getBoundingClientRect();
      return window.scrollY <= 0 || rect.top >= 0;
    };

    const reset = () => {
      pulling.current = false;
      distRef.current = 0;
      animating.current = false;
      setDistance(0);
    };

    const handleStart = (e) => {
      if (refreshing || !atTop()) return;
      startY.current = e.touches[0].clientY;
      pulling.current = true;
      animating.current = true;
    };

    const handleMove = (e) => {
      if (!pulling.current) return;

      const delta = e.touches[0].clientY - startY.current;

      if (delta <= 0) {
        reset();
        return;
      }

      // Suppress native scroll / browser overscroll only while actively pulling.
      if (e.cancelable) e.preventDefault();

      const next = Math.min(MAX_PULL, delta * RESISTANCE);
      distRef.current = next;
      setDistance(next);
    };

    const handleEnd = async () => {
      if (!pulling.current) return;
      pulling.current = false;
      animating.current = false;

      if (distRef.current >= THRESHOLD) {
        setRefreshing(true);
        setDistance(THRESHOLD);
        try {
          await onRefresh?.();
        } finally {
          setRefreshing(false);
          distRef.current = 0;
          setDistance(0);
        }
      } else {
        distRef.current = 0;
        setDistance(0);
      }
    };

    el.addEventListener("touchstart", handleStart, { passive: true });
    el.addEventListener("touchmove", handleMove, { passive: false });
    el.addEventListener("touchend", handleEnd);
    el.addEventListener("touchcancel", handleEnd);

    return () => {
      el.removeEventListener("touchstart", handleStart);
      el.removeEventListener("touchmove", handleMove);
      el.removeEventListener("touchend", handleEnd);
      el.removeEventListener("touchcancel", handleEnd);
    };
  }, [onRefresh, refreshing, disabled]);

  const ready = distance >= THRESHOLD;
  const opacity = Math.min(1, distance / THRESHOLD);

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{ overscrollBehaviorY: "contain" }}
    >
      {/* Pull indicator — occupies the gap opened up by the drag */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-center overflow-hidden"
        style={{ height: distance }}
      >
        <div
          className={`mt-3 h-6 w-6 rounded-full border-2 border-stone-200 border-t-stone-900 ${
            refreshing ? "animate-spin" : ""
          }`}
          style={{
            opacity,
            transform: refreshing ? undefined : `rotate(${distance * 3}deg)`,
          }}
        />
      </div>

      <div
        style={{
          transform: `translateY(${distance}px)`,
          transition: animating.current ? "none" : "transform 220ms ease-out",
        }}
      >
        {children}
      </div>

      {/* Screen-reader announcement */}
      <span className="sr-only" role="status" aria-live="polite">
        {refreshing ? "Refreshing" : ready ? "Release to refresh" : ""}
      </span>
    </div>
  );
}
