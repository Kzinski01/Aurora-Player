import clsx from "clsx";

// One vector signature, shared by the brand, analysis action and empty states.
export default function PixelCloud({ state = "idle", className }) {
  return (
    <svg viewBox="0 0 48 36" fill="none" aria-hidden="true" className={clsx("pixel-cloud", `pixel-cloud--${state}`, className)}>
      <path d="M4 20H8V12H16V8H28V12H36V16H40V20H44V28H40V32H8V28H4V20Z" fill="currentColor" opacity=".15" />
      <path d="M4 20H8V12H16V8H28V12H36V16H40V20H44V28H40V32H8V28H4V20Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="miter" />
      <path d="M12 16H18V12H26" stroke="currentColor" strokeWidth="2" opacity=".55" />
      {state === "success" ? <path d="M18 22L22 26L30 18" stroke="currentColor" strokeWidth="2.5" />
        : state === "error" ? <path d="M24 17V23M24 26V28" stroke="currentColor" strokeWidth="2.5" />
        : <g className="cloud-pixels" fill="currentColor"><path d="M17 22h3v3h-3z" /><path d="M23 22h3v3h-3z" /><path d="M29 22h3v3h-3z" /></g>}
    </svg>
  );
}
