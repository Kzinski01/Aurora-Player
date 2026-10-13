import { useCallback, useEffect, useRef, useState } from "react";

// Scrubbable progress bar. Pointer capture is what lets a drag continue after
// the cursor leaves the 500px-wide window — without it, dragging past the edge
// would silently drop the gesture and strand the thumb mid-seek.
export default function MiniProgress({ value, max, onSeek }) {
  const trackRef = useRef(null);
  // While dragging, the bar follows the pointer instead of the player: the
  // seek only lands on release, and echoing the stale playback position in the
  // meantime would make the thumb fight the cursor.
  const [dragValue, setDragValue] = useState(null);
  const [hovered, setHovered] = useState(false);

  const safeMax = max > 0 ? max : 1;
  const shown = dragValue ?? value;
  const ratio = Math.min(1, Math.max(0, shown / safeMax));

  const valueFromEvent = useCallback(
    (event) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return 0;
      const position = (event.clientX - rect.left) / rect.width;
      return Math.min(1, Math.max(0, position)) * safeMax;
    },
    [safeMax]
  );

  const handlePointerDown = (event) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragValue(valueFromEvent(event));
  };

  const handlePointerMove = (event) => {
    if (dragValue === null) return;
    setDragValue(valueFromEvent(event));
  };

  const handlePointerUp = (event) => {
    if (dragValue === null) return;
    const target = valueFromEvent(event);
    setDragValue(null);
    onSeek(target);
  };

  // A drag interrupted by anything other than pointerup (window hidden, the
  // pointer lost) would otherwise leave the bar frozen at the drag position.
  useEffect(() => {
    const cancel = () => setDragValue(null);
    window.addEventListener("blur", cancel);
    return () => window.removeEventListener("blur", cancel);
  }, []);

  return (
    <div
      ref={trackRef}
      // The whole card is a drag region for moving the window; every control
      // has to opt out or it can never be clicked.
      style={{ WebkitAppRegion: "no-drag" }}
      className="group relative flex h-3 w-full cursor-pointer items-center"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => setDragValue(null)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="h-[3px] w-full overflow-hidden rounded-full bg-ink/[0.12]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent-deep to-accent"
          style={{
            width: `${ratio * 100}%`,
            // No transition mid-drag: the bar must track the pointer exactly.
            transition: dragValue === null ? "width 180ms linear" : "none",
          }}
        />
      </div>
      <span
        className="pointer-events-none absolute h-[8px] w-[8px] -translate-x-1/2 rounded-full bg-ink shadow-[0_1px_4px_rgba(0,0,0,0.35)]"
        style={{
          left: `${ratio * 100}%`,
          opacity: hovered || dragValue !== null ? 1 : 0,
          transform: `translateX(-50%) scale(${dragValue !== null ? 1.15 : 1})`,
          transition: "opacity 160ms ease, transform 160ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      />
    </div>
  );
}
