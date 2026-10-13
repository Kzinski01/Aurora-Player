import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "../../i18n/index.js";
import { formatDuration } from "../../lib/format.js";

// Two-handle range selector over a media duration, with a playhead showing
// where preview playback currently is.
//
// Pointer capture is what makes a drag survive the cursor leaving the track —
// without it, dragging past the edge of the timeline silently drops the gesture
// and strands the handle wherever the pointer happened to exit.

const HANDLE_HIT_AREA = 14;

export default function TrimTimeline({ duration, start, end, playhead, onChangeStart, onChangeEnd, onSeek }) {
  const { t } = useTranslation();
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(null); // "start" | "end" | "seek"

  const safeDuration = duration > 0 ? duration : 1;
  const pct = (seconds) => `${Math.min(100, Math.max(0, (seconds / safeDuration) * 100))}%`;

  const secondsAt = useCallback(
    (event) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return 0;
      const ratio = (event.clientX - rect.left) / rect.width;
      return Math.min(1, Math.max(0, ratio)) * safeDuration;
    },
    [safeDuration]
  );

  // Which handle a press should grab: whichever is closer, unless the press
  // lands clearly outside the selection, in which case it's a seek.
  const handleFor = useCallback(
    (seconds) => {
      const tolerance = (HANDLE_HIT_AREA / (trackRef.current?.clientWidth || 1)) * safeDuration;
      if (Math.abs(seconds - start) <= tolerance) return "start";
      if (Math.abs(seconds - end) <= tolerance) return "end";
      if (seconds > start && seconds < end) return "seek";
      return Math.abs(seconds - start) < Math.abs(seconds - end) ? "start" : "end";
    },
    [start, end, safeDuration]
  );

  const apply = useCallback(
    (mode, seconds) => {
      if (mode === "start") onChangeStart(seconds);
      else if (mode === "end") onChangeEnd(seconds);
      else onSeek(seconds);
    },
    [onChangeStart, onChangeEnd, onSeek]
  );

  const onPointerDown = (event) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const seconds = secondsAt(event);
    const mode = handleFor(seconds);
    setDragging(mode);
    apply(mode, seconds);
  };

  const onPointerMove = (event) => {
    if (!dragging) return;
    apply(dragging, secondsAt(event));
  };

  const stop = () => setDragging(null);

  // A drag interrupted by anything other than pointerup (window blur, pointer
  // lost) would otherwise leave the timeline convinced it is still dragging.
  useEffect(() => {
    window.addEventListener("blur", stop);
    return () => window.removeEventListener("blur", stop);
  }, []);

  return (
    <div className="select-none">
      <div
        ref={trackRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stop}
        onPointerCancel={stop}
        className="trim-track relative h-16 w-full cursor-pointer rounded-lg ring-1 ring-inset ring-ink/[0.1]"
      >
        {/* Everything outside the selection is dimmed, so the kept range reads
            as the subject rather than as one more marker on a bar. */}
        <div className="absolute inset-y-0 left-0 rounded-l-lg bg-ink/[0.06]" style={{ width: pct(start) }} />
        <div className="absolute inset-y-0 right-0 rounded-r-lg bg-ink/[0.06]" style={{ left: pct(end) }} />

        <div
          className="absolute inset-y-0 bg-gradient-to-r from-accent/25 to-accent-soft/25 ring-1 ring-inset ring-accent/40"
          style={{ left: pct(start), right: `calc(100% - ${pct(end)})` }}
        />

        {playhead > start && playhead < end && (
          <div className="absolute inset-y-1 w-px bg-ink/70" style={{ left: pct(playhead) }} />
        )}

        <Handle position={pct(start)} active={dragging === "start"} label={t("studio.trimStart")} value={start} min={0} max={end} onChange={onChangeStart} />
        <Handle position={pct(end)} active={dragging === "end"} label={t("studio.trimEnd")} value={end} min={start} max={duration} onChange={onChangeEnd} />
      </div>

      <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-ink/40">
        <span>{formatDuration(0)}</span>
        <span>{formatDuration(duration)}</span>
      </div>
    </div>
  );
}

function Handle({ position, active, label, value, min, max, onChange }) {
  return (
    <div
      role="slider" tabIndex={0} aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} aria-valuetext={formatDuration(value)}
      onKeyDown={event => {
        const directions = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 };
        if (!(event.key in directions) && event.key !== "Home" && event.key !== "End") return;
        event.preventDefault();
        const next = event.key === "Home" ? min : event.key === "End" ? max : value + directions[event.key] * (event.shiftKey ? 5 : .1);
        onChange(Math.max(min, Math.min(max, next)));
      }}
      className="absolute inset-y-0 flex w-3 -translate-x-1/2 items-center justify-center"
      style={{ left: position }}
    >
      <div
        className={`h-full w-1 rounded-full transition-colors ${active ? "bg-accent-soft" : "bg-accent"}`}
      />
    </div>
  );
}
