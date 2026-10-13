import clsx from "clsx";

// Adapted from the 21st.dev "shine border" component. The original is a
// shadcn/TypeScript piece that leans on `cn` and a wall of Tailwind arbitrary
// values for the mask trick; this project is plain JSX with its own class
// helper, so the mask lives in inline styles where it's actually readable.
// The animation itself is the original's: a `shine-pulse` keyframe sweeping an
// oversized radial gradient across a border-width ring (see tailwind.config.js).
//
// The ring is drawn on a pseudo-element that is painted *only* in the padding
// box — `mask-composite: exclude` punches the content area out of it — which is
// what leaves a border-thin sliver of moving gradient around the card.
export default function ShineBorder({
  borderRadius = 24,
  borderWidth = 1,
  duration = 14,
  color = "#7C6CFF",
  className,
  style,
  children,
}) {
  const colors = Array.isArray(color) ? color.join(",") : color;

  return (
    // Deliberately unsized: an `h-full w-full` here would collide with whatever
    // size the caller passes, and between two Tailwind classes of equal
    // specificity the winner is decided by stylesheet order, not by the order
    // they appear in the attribute — which silently stretched the mini player's
    // card to fill its window.
    <div
      className={clsx("relative", className)}
      style={{ borderRadius: `${borderRadius}px`, ...style }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 motion-safe:animate-[shine-pulse_var(--shine-duration)_infinite_linear]"
        style={{
          borderRadius: `${borderRadius}px`,
          padding: `${borderWidth}px`,
          "--shine-duration": `${duration}s`,
          backgroundImage: `radial-gradient(transparent, transparent, ${colors}, transparent, transparent)`,
          backgroundSize: "300% 300%",
          willChange: "background-position",
          mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          maskComposite: "exclude",
          WebkitMaskComposite: "xor",
        }}
      />
      {children}
    </div>
  );
}
