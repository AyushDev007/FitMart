import { useEffect, useRef, useState } from "react";

const THRESHOLD = 70;   // px of pull needed to trigger
const MAX_PULL = 110;   // cap so it can't be dragged forever
const RESISTANCE = 0.5; // pull feels heavier than the finger moves

export default function PullToRefresh({ onRefresh, children, disabled = false }) {
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const distRef = useRef(0);

  useEffect(() => {
    // Touch-only feature — don't bind anything on desktop.
    if (disabled || !("ontouchstart" in window)) return;

    const handleStart = (e) => {
      if (refreshing || window.scrollY > 0) return;
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    };

    const handleMove = (e) => {
      if (!pulling.current) return;
      const delta = e.touches[0].clientY - startY.current;

      if (delta <= 0) {
        pulling.current = false;
        distRef.current = 0;
        setDistance(0);
        return;
      }
      // Suppress native scroll/overscroll only while actively pulling.
      if (e.cancelable) e.preventDefault();

      const next = Math.min(MAX_PULL, delta * RESISTANCE);
      distRef.current = next;
      setDistance(next);
    };

    const handleEnd = async () => {
      if (!pulling.current) return;
      pulling.current = false;

      if (distRef.current >= THRESHOLD) {
        setRefreshing(true);
        setDistance(THRESHOLD);
        try {
          await onRefresh?.();
        } finally {
          setRefreshing(false);
          setDistance(0);
          distRef.current = 0;
        }
      } else {
        setDistance(0);
        distRef.current = 0;
      }
    };

    window.addEventListener("touchstart", handleStart, { passive: true });
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleEnd);
    window.addEventListener("touchcancel", handleEnd);

    return () => {
      window.removeEventListener("touchstart", handleStart);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
      window.removeEventListener("touchcancel", handleEnd);
    };
  }, [onRefresh, refreshing, disabled]);

  const ready = distance >= THRESHOLD;

  return (
    <div className="relative" style={{ overscrollBehaviorY: "contain" }}>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 flex justify-center overflow-hidden"
        style={{ height: distance }}
        aria-hidden={!refreshing}
      >
        <div
          className={`mt-3 h-6 w-6 rounded-full border-2 border-stone-200 border-t-stone-900 ${
            refreshing ? "animate-spin" : ""
          }`}
          style={{ transform: refreshing ? undefined : `rotate(${distance * 3}deg)` }}
        />
      </div>

      <div
        style={{
          transform: `translateY(${distance}px)`,
          transition: pulling.current ? "none" : "transform 220ms ease-out",
        }}
      >
        {children}
      </div>

      <span className="sr-only" role="status" aria-live="polite">
        {refreshing ? "Refreshing" : ready ? "Release to refresh" : ""}
      </span>
    </div>
  );
}
