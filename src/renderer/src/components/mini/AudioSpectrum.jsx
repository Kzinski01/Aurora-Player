import { useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";
import aurora from "../../lib/aurora.js";

// Canvas spectrum for the background player.
//
// Two clocks, on purpose. Band magnitudes arrive from the main window (which
// owns the audio element, and therefore the AnalyserNode) about 30×/second over
// IPC; this canvas runs its own requestAnimationFrame loop at the display's
// rate and eases toward whichever magnitudes arrived last. The easing is what
// turns a 30 Hz data feed into 60 fps motion — without it the bars would step
// visibly on every message.
//
// The loop deliberately touches no React state: re-rendering a component 60×
// per second to move pixels is the expensive way to do this. Everything the
// frame needs lives in refs, and React only re-runs the effects when the
// *configuration* changes.

const DEFAULTS = {
  barCount: 72,
  barSpacing: 2,
  cornerRadius: 1.5,
  height: 24,
  // Rise fast, fall slow: matching the attack makes a beat look like a flicker,
  // while a slow fall reads as a note ringing out.
  attack: 0.42,
  decay: 0.11,
  // How quickly the whole visualiser fades between playing/paused/stopped.
  fadeSpeed: 0.07,
  // Resting height when paused — present enough to look alive, low enough to
  // stop being movement in the corner of someone's eye.
  idleLevel: 0.05,
  idleWaveSpeed: 0.0009,
  idleWaveAmount: 0.025,
  // Bars never reach the very top; a ceiling below 1 keeps the loudest moments
  // from flattening against the edge, which is what looks clipped and cheap.
  maxScale: 0.92,
  // requestAnimationFrame fires at the display's rate, which on a 240 Hz
  // monitor means drawing four times per band update for no visible gain. The
  // spectrum is background chrome, so it is capped at the target the design
  // asks for and the spare frames are simply skipped.
  fps: 60,
};

// The easing constants above describe motion *per 60ths of a second*. Applied
// raw, they would make the bars settle four times faster on a 240 Hz display
// than on a 60 Hz one — same code, different feel per machine. Re-deriving the
// factor from the real frame delta keeps the motion identical everywhere.
const REFERENCE_FRAME_MS = 1000 / 60;
function frameRateAdjusted(factor, deltaMs) {
  if (deltaMs <= 0) return factor;
  return 1 - (1 - factor) ** (deltaMs / REFERENCE_FRAME_MS);
}

// Bars are painted from a single vertical gradient rather than per-bar colours:
// one gradient object, reused every frame, and the accent reads as one wash
// across the strip instead of 72 independent stripes.
function buildGradient(ctx, height, theme) {
  const root = getComputedStyle(document.documentElement);
  const accent = root.getPropertyValue("--accent").trim() || "124 108 255";
  const soft = root.getPropertyValue("--accent-soft").trim() || "156 144 255";
  const deep = root.getPropertyValue("--accent-deep").trim() || "76 70 184";

  // Dark theme: lift toward the lighter companion so bars sit *brighter* than
  // the surface. Light theme: fall toward the darker one, so they sit darker
  // than a near-white card. Same gradient direction, inverted palette.
  const [bottom, top] = theme === "light" ? [deep, accent] : [accent, soft];

  const gradient = ctx.createLinearGradient(0, height, 0, 0);
  gradient.addColorStop(0, `rgb(${bottom} / 0.95)`);
  gradient.addColorStop(1, `rgb(${top} / 0.55)`);
  return gradient;
}

// The transport resolution (see lib/spectrum.js) and the configured bar count
// are independent, so incoming bands are resampled to whatever this instance
// draws. Nearest-neighbour is enough: adjacent bands are already correlated.
function resample(source, target, count) {
  if (!source || source.length === 0) {
    target.fill(0);
    return;
  }
  const ratio = source.length / count;
  for (let i = 0; i < count; i += 1) {
    const start = Math.floor(i * ratio);
    const end = Math.max(start + 1, Math.floor((i + 1) * ratio));
    let peak = 0;
    for (let j = start; j < end && j < source.length; j += 1) {
      if (source[j] > peak) peak = source[j];
    }
    target[i] = peak;
  }
}

export default function AudioSpectrum({
  isPlaying = false,
  hasTrack = false,
  theme = "dark",
  accentColor,
  subscribe = aurora.onMiniSpectrum,
  ...options
}) {
  const reducedMotion = useReducedMotion();
  const canvasRef = useRef(null);
  const config = { ...DEFAULTS, ...options };

  // Refs the animation loop reads without restarting: changing these must not
  // tear down the rAF loop mid-motion.
  const stateRef = useRef({ isPlaying, hasTrack, theme, accentColor, reducedMotion });
  stateRef.current = { isPlaying, hasTrack, theme, accentColor, reducedMotion };

  const targetsRef = useRef(new Float32Array(config.barCount));
  const levelsRef = useRef(new Float32Array(config.barCount));
  const opacityRef = useRef(0);

  // Incoming magnitudes are written straight into the target buffer, outside
  // React, so a message never triggers a render.
  useEffect(() => {
    return subscribe((bands) => resample(bands, targetsRef.current, targetsRef.current.length));
  }, [subscribe]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return undefined;

    const { barCount, barSpacing, cornerRadius, height, attack, decay, fadeSpeed, idleLevel, idleWaveSpeed, idleWaveAmount, maxScale, fps } = config;

    let frame = 0;
    let gradient = null;
    let gradientKey = "";
    let cssWidth = 0;
    let lastDraw = 0;
    // Slightly under the exact interval so a frame arriving a hair early isn't
    // dropped, which would otherwise halve the effective rate.
    const minFrameMs = 1000 / fps - 2;

    // The backing store is sized in device pixels and the context scaled to
    // match, or every bar edge lands on a half-pixel and the whole strip looks
    // soft on a HiDPI display.
    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      if (width === 0) return;
      cssWidth = width;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      gradient = null;
    };
    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const draw = (time) => {
      frame = requestAnimationFrame(draw);
      if (cssWidth === 0) return;

      const delta = time - lastDraw;
      if (delta < minFrameMs) return;
      lastDraw = time;

      const attackNow = frameRateAdjusted(attack, delta);
      const decayNow = frameRateAdjusted(decay, delta);
      const fadeNow = frameRateAdjusted(fadeSpeed, delta);

      const { isPlaying: playing, hasTrack: track, theme: activeTheme, accentColor: accent } = stateRef.current;
      const targets = targetsRef.current;
      const levels = levelsRef.current;

      // Rebuilt only when the palette actually changes — createLinearGradient
      // every frame would be an allocation 60×/second for an identical object.
      const key = `${activeTheme}|${accent}|${canvas.height}`;
      if (!gradient || key !== gradientKey) {
        gradient = buildGradient(ctx, height, activeTheme);
        gradientKey = key;
      }

      const targetOpacity = track ? (playing ? 1 : 0.42) : 0;
      opacityRef.current += (targetOpacity - opacityRef.current) * fadeNow;

      ctx.clearRect(0, 0, cssWidth, height);
      if (opacityRef.current < 0.01) return;

      const barWidth = (cssWidth - barSpacing * (barCount - 1)) / barCount;
      ctx.globalAlpha = opacityRef.current;
      ctx.fillStyle = gradient;
      ctx.beginPath();

      for (let i = 0; i < barCount; i += 1) {
        // Paused: settle to a slow, shallow travelling wave instead of freezing
        // on whatever the last loud frame happened to be.
        const target = stateRef.current.reducedMotion ? idleLevel : playing
          ? targets[i]
          : idleLevel + Math.sin(time * idleWaveSpeed + i * 0.35) * idleWaveAmount;

        const current = levels[i];
        levels[i] = current + (target - current) * (target > current ? attackNow : decayNow);

        const barHeight = Math.max(1, Math.min(1, levels[i]) * maxScale * height);
        const x = i * (barWidth + barSpacing);
        const y = height - barHeight;
        const radius = Math.min(cornerRadius, barWidth / 2, barHeight / 2);
        ctx.roundRect(x, y, barWidth, barHeight, radius);
      }

      // One fill for all 72 bars — batching the path is what keeps this cheap
      // enough to run every frame without showing up in CPU usage.
      ctx.fill();
      ctx.globalAlpha = 1;
    };

    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.barCount, config.barSpacing, config.cornerRadius, config.height, config.fps]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="block w-full"
      style={{ height: config.height }}
    />
  );
}
