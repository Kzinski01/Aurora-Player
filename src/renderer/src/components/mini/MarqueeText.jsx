import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

// A title that only moves when it has to. Short titles sit still; long ones
// hold for a beat, crawl left, fade out at the end and re-enter from the right.
//
// The keyframes are generated per-instance because the travel distance depends
// on how far *this* title overflows, and the timing is expressed in percentages
// of a duration derived from that distance — so every title moves at the same
// slow speed regardless of length, instead of long ones racing to finish in a
// fixed time.
const PIXELS_PER_SECOND = 14;
const HOLD_SECONDS = 3.5;
const FADE_SECONDS = 0.55;
const REENTRY_OFFSET_PX = 28;

export default function MarqueeText({ text, className }) {
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const [overflow, setOverflow] = useState(0);
  // useId gives each instance its own animation name, so two marquees on the
  // same page can't clobber each other's keyframes.
  const animationName = `marquee-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  // Layout effect, not effect: measuring after paint would show one frame of
  // the previous title's animation applied to the new text.
  useLayoutEffect(() => {
    const container = containerRef.current;
    const textNode = textRef.current;
    if (!container || !textNode) return;
    const distance = textNode.scrollWidth - container.clientWidth;
    setOverflow(distance > 2 ? distance : 0);
  }, [text]);

  // Fonts land after first paint and change the measured width, so a title that
  // fits with the fallback font but overflows with the real one still gets its
  // marquee.
  useEffect(() => {
    if (!document.fonts?.ready) return;
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (cancelled) return;
      const container = containerRef.current;
      const textNode = textRef.current;
      if (!container || !textNode) return;
      const distance = textNode.scrollWidth - container.clientWidth;
      setOverflow(distance > 2 ? distance : 0);
    });
    return () => {
      cancelled = true;
    };
  }, [text]);

  const travelSeconds = overflow / PIXELS_PER_SECOND;
  const totalSeconds = HOLD_SECONDS + travelSeconds + FADE_SECONDS * 2;
  const pct = (seconds) => `${((seconds / totalSeconds) * 100).toFixed(3)}%`;

  const keyframes = overflow
    ? `@keyframes ${animationName} {
        0%, ${pct(HOLD_SECONDS)} { transform: translateX(0); opacity: 1; }
        ${pct(HOLD_SECONDS + travelSeconds)} { transform: translateX(-${overflow}px); opacity: 1; }
        ${pct(HOLD_SECONDS + travelSeconds + FADE_SECONDS)} { transform: translateX(-${overflow}px); opacity: 0; }
        ${pct(HOLD_SECONDS + travelSeconds + FADE_SECONDS + 0.001)} { transform: translateX(${REENTRY_OFFSET_PX}px); opacity: 0; }
        100% { transform: translateX(0); opacity: 1; }
      }`
    : "";

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className ?? ""}`}>
      {keyframes && <style>{keyframes}</style>}
      <span
        ref={textRef}
        // Sizing to the text (not the container) is what makes scrollWidth
        // report the true rendered width instead of the clipped one.
        className="inline-block whitespace-nowrap will-change-transform"
        style={
          overflow
            ? { animation: `${animationName} ${totalSeconds}s linear infinite` }
            : undefined
        }
      >
        {text}
      </span>
    </div>
  );
}
